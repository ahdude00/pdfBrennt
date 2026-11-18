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

// Words in justified lines may differ by less than two points: UYAP spreads the
// free width with a rounding scheme that is not reproduced exactly.
const justifiedTolerance = 2;
let nearMisses = 0;

function compareList(kind, ours, theirs, key, describe, near) {
  const problems = [];
  const a = [...ours].sort(order);
  const b = [...theirs].sort(order);
  if (a.length !== b.length) problems.push(`${kind}: ${a.length} vs ${b.length} in reference`);
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count && problems.length < 6; index++) {
    if (key(a[index], b[index])) continue;
    if (near?.(a[index], b[index])) {
      nearMisses++;
      continue;
    }
    problems.push(`${kind} #${index}: ours ${describe(a[index])} | reference ${describe(b[index])}`);
  }
  return problems;
}

export async function compareCase(name) {
  const udf = new Uint8Array(readFileSync(join(caseDir, `${name}.udf`)));
  const reference = await readLayout(readFileSync(join(referenceDir, `${name}.pdf`)));
  let ours;
  try {
    const result = await convertUdf(udf, { loadFallbackFont });
    ours = await readLayout(result.bytes);
  } catch (error) {
    return [`conversion failed: ${error.message}`];
  }
  const problems = [];
  if (ours.length !== reference.length) problems.push(`pages: ${ours.length} vs ${reference.length} in reference`);
  for (let index = 0; index < Math.min(ours.length, reference.length); index++) {
    const page = ours[index];
    const other = reference[index];
    const prefix = `page ${index + 1}`;
    if (!near(page.width, other.width) || !near(page.height, other.height)) problems.push(`${prefix} size ${f(page.width)}x${f(page.height)} vs ${f(other.width)}x${f(other.height)}`);
    const words = list => list.filter(run => run.text.trim()).map(run => ({ ...run, text: run.text.trim() }));
    problems.push(...compareList(`${prefix} words`, words(page.runs), words(other.runs),
      (a, b) => a.text === b.text && near(a.x, b.x) && near(a.y, b.y) && near(a.size, b.size),
      run => `${JSON.stringify(run.text)} @${f(run.x)},${f(run.y)} ${f(run.size)}pt`,
      (a, b) => a.text === b.text && Math.abs(a.x - b.x) < justifiedTolerance && near(a.y, b.y) && near(a.size, b.size)));
    problems.push(...compareList(`${prefix} images`, page.images, other.images,
      (a, b) => near(a.x, b.x) && near(a.y, b.y) && near(a.width, b.width) && near(a.height, b.height),
      image => `${f(image.x)},${f(image.y)} ${f(image.width)}x${f(image.height)}`));
    // UYAP draws a page by clipping the whole document view, so off-page strokes exist but are invisible.
    const visible = box => box.y1 >= 0 && box.y0 <= page.height && box.x1 >= 0 && box.x0 <= page.width;
    const boxes = list => list.filter(visible).map(box => ({ x: box.x0, y: box.y0, x1: box.x1, y1: box.y1 }));
    problems.push(...compareList(`${prefix} strokes`, boxes(page.strokes), boxes(other.strokes),
      (a, b) => near(a.x, b.x) && near(a.y, b.y) && near(a.x1, b.x1) && near(a.y1, b.y1),
      box => `${f(box.x)},${f(box.y)}–${f(box.x1)},${f(box.y1)}`));
    // Filled shapes (list bullets). Curves may be flattened differently, so allow 0.1 pt.
    const painted = list => boxes(list.filter(box => box.color !== "255,255,255"));
    problems.push(...compareList(`${prefix} fills`, painted(page.fills), painted(other.fills),
      (a, b) => [a.x - b.x, a.y - b.y, a.x1 - b.x1, a.y1 - b.y1].every(value => Math.abs(value) <= 0.1),
      box => `${f(box.x)},${f(box.y)}–${f(box.x1)},${f(box.y1)}`));
  }
  return problems;
}

if (process.argv[1]?.endsWith("compare.mjs")) {
  const names = readdirSync(caseDir).filter(file => file.endsWith(".udf")).map(file => file.replace(/\.udf$/, ""))
    .filter(name => existsSync(join(referenceDir, `${name}.pdf`)))
    .filter(name => !only.length || only.includes(name));
  let failed = 0;
  let near = 0;
  for (const name of names) {
    nearMisses = 0;
    const problems = await compareCase(name);
    if (problems.length) failed++;
    else if (nearMisses) near++;
    console.log(`${problems.length ? "FAIL" : nearMisses ? "NEAR" : "OK  "} ${name}${nearMisses ? ` (${nearMisses} justified words within 2 pt)` : ""}`);
    for (const problem of problems.slice(0, verbose ? 60 : 8)) console.log(`     ${problem}`);
  }
  console.log(`${names.length - failed - near} exact, ${near} near, ${failed} failed of ${names.length}`);
  process.exitCode = failed ? 1 : 0;
}
