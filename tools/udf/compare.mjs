// Converts every test UDF with PDF Brennt and compares the result with the
// UYAP Editör reference: page count and size, the position of every word,
// every image and every stroke. Exits with 1 when something differs.
// Usage: node tools/udf/compare.mjs [case names...] [--verbose]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { convertUdf } from "../../src/udf/convert.js";
import { readLayout } from "./pdf-layout.mjs";
import { toolDir } from "./java.mjs";

const root = join(toolDir, "..", "..");
const caseDir = join(root, "test", "udf", "cases");
const referenceDir = join(root, "test", "udf", "reference");
const fontFiles = { "Liberation Serif": "LiberationSerif", "Liberation Sans": "LiberationSans" };
const faceFiles = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "BoldItalic" };
const tolerance = 0.02;
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const only = args.filter(arg => !arg.startsWith("--"));

function loadFallbackFont(family, face) {
  return new Uint8Array(readFileSync(join(root, "src", "udf-fonts", `${fontFiles[family]}-${faceFiles[face]}.ttf`)));
}

const order = (a, b) => (b.y - a.y) || (a.x - b.x);
const near = (a, b) => Math.abs(a - b) <= tolerance;
const f = value => +value.toFixed(2);

function compareList(kind, ours, theirs, key, describe) {
  const problems = [];
  const a = [...ours].sort(order);
  const b = [...theirs].sort(order);
  if (a.length !== b.length) problems.push(`${kind}: ${a.length} vs ${b.length} in reference`);
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count && problems.length < 6; index++) {
    if (key(a[index], b[index])) continue;
    problems.push(`${kind} #${index}: ours ${describe(a[index])} | reference ${describe(b[index])}`);
  }
  return problems;
}

export async function compareCase(name) {
  // Page numbers that UYAP drew as outlines, verified by tools/udf/outlines.mjs.
  const numbersFile = join(referenceDir, `${name}.numbers.json`);
  const numbers = existsSync(numbersFile) ? JSON.parse(readFileSync(numbersFile, "utf8")) : [];
  return compareFiles(readFileSync(join(caseDir, `${name}.udf`)), readFileSync(join(referenceDir, `${name}.pdf`)), numbers);
}

// Compares PDF Brennt's conversion of a UDF with UYAP's PDF of it.
export async function compareFiles(udfBytes, referenceBytes, numbers = []) {
  const reference = await readLayout(referenceBytes);
  let ours;
  try {
    const result = await convertUdf(new Uint8Array(udfBytes), { loadFallbackFont });
    ours = await readLayout(result.bytes);
  } catch (error) {
    return [`conversion failed: ${error.message}`];
  }
  const problems = [];
  if (ours.length !== reference.length) problems.push(`pages: ${ours.length} vs ${reference.length} in reference`);
  for (let index = 0; index < Math.min(ours.length, reference.length); index++) {
    const page = ours[index];
    const other = { ...reference[index] };
    const prefix = `page ${index + 1}`;
    if (!near(page.width, other.width) || !near(page.height, other.height)) problems.push(`${prefix} size ${f(page.width)}x${f(page.height)} vs ${f(other.width)}x${f(other.height)}`);
    const pageNumbers = numbers.filter(number => number.page === index + 1);
    other.runs = [...other.runs, ...pageNumbers];
    other.fills = other.fills.filter(fill => !pageNumbers.some(({ outline }) =>
      [fill.x0 - outline.x0, fill.y0 - outline.y0, fill.x1 - outline.x1, fill.y1 - outline.y1].every(value => Math.abs(value) <= 0.002)));
    // UYAP paints list markers of neighbouring pages outside the page box; they are invisible.
    const onPage = run => run.y > -run.size && run.y < page.height + run.size;
    const words = list => list.filter(run => run.text.trim() && onPage(run)).map(run => ({ ...run, text: run.text.trim() }));
    problems.push(...compareList(`${prefix} words`, words(page.runs), words(other.runs),
      (a, b) => a.text === b.text && near(a.x, b.x) && near(a.y, b.y) && near(a.size, b.size),
      run => `${JSON.stringify(run.text)} @${f(run.x)},${f(run.y)} ${f(run.size)}pt`));
    problems.push(...compareList(`${prefix} images`, page.images, other.images,
      (a, b) => near(a.x, b.x) && near(a.y, b.y) && near(a.width, b.width) && near(a.height, b.height),
      image => `${f(image.x)},${f(image.y)} ${f(image.width)}x${f(image.height)}`));
    // UYAP draws a page by clipping the whole document view, so off-page strokes exist but are invisible.
    // Zero-length strokes (underlines of empty views) paint nothing.
    const visible = box => box.y1 >= 0 && box.y0 <= page.height && box.x1 >= 0 && box.x0 <= page.width && (box.x1 > box.x0 || box.y1 > box.y0);
    const boxes = list => list.filter(visible).map(box => ({ x: box.x0, y: box.y0, x1: box.x1, y1: box.y1, width: box.width, cap: box.cap, dash: box.dash, color: box.color }));
    // Strokes must also match in pen: width, cap, dash pattern and colour.
    problems.push(...compareList(`${prefix} strokes`, boxes(page.strokes), boxes(other.strokes),
      (a, b) => near(a.x, b.x) && near(a.y, b.y) && near(a.x1, b.x1) && near(a.y1, b.y1) && near(a.width, b.width) && a.cap === b.cap && a.dash === b.dash && a.color === b.color,
      box => `${f(box.x)},${f(box.y)}–${f(box.x1)},${f(box.y1)} w${f(box.width)} cap${box.cap}${box.dash ? ` dash${box.dash}` : ""} ${box.color}`));
    // Filled shapes (bullets, highlights) and their colour. Curves may be flattened
    // differently, so allow 0.1 pt. White fills are invisible on the page.
    const painted = list => boxes(list.filter(box => box.color !== "255,255,255"));
    problems.push(...compareList(`${prefix} fills`, painted(page.fills), painted(other.fills),
      (a, b) => [a.x - b.x, a.y - b.y, a.x1 - b.x1, a.y1 - b.y1].every(value => Math.abs(value) <= 0.1) && a.color === b.color,
      box => `${f(box.x)},${f(box.y)}–${f(box.x1)},${f(box.y1)} ${box.color}`));
  }
  return problems;
}

if (process.argv[1]?.endsWith("compare.mjs")) {
  const names = readdirSync(caseDir).filter(file => file.endsWith(".udf")).map(file => file.replace(/\.udf$/, ""))
    .filter(name => existsSync(join(referenceDir, `${name}.pdf`)))
    .filter(name => !only.length || only.includes(name));
  let failed = 0;
  for (const name of names) {
    const problems = await compareCase(name);
    if (problems.length) failed++;
    console.log(`${problems.length ? "FAIL" : "OK  "} ${name}`);
    for (const problem of problems.slice(0, verbose ? 60 : 8)) console.log(`     ${problem}`);
  }
  console.log(`${names.length - failed} exact, ${failed} failed of ${names.length}`);
  process.exitCode = failed ? 1 : 0;
}
