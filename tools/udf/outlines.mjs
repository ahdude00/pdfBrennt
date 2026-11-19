// UYAP Editör draws page numbers with java.awt.font.TextLayout, which iText writes
// as glyph outlines, not text. This tool converts every reference case with PDF
// Brennt using the Windows fonts UYAP measured with (same glyph shapes), checks that
// each page-number run lands exactly on UYAP's outline, and records the verified runs
// in test/udf/reference/<case>.numbers.json for tools/udf/compare.mjs.
// It needs C:/Windows/Fonts; run it after `npm run udf:references`.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { convertUdf } from "../../src/udf/convert.js";
import { readLayout } from "./pdf-layout.mjs";
import { toolDir } from "./java.mjs";

const root = join(toolDir, "..", "..");
const caseDir = join(root, "test", "udf", "cases");
const referenceDir = join(root, "test", "udf", "reference");
const fontDir = process.env.WINDOWS_FONTS ?? "C:/Windows/Fonts";
const files = {
  "Times New Roman": { regular: "times.ttf", bold: "timesbd.ttf", italic: "timesi.ttf", boldItalic: "timesbi.ttf" },
  Arial: { regular: "arial.ttf", bold: "arialbd.ttf", italic: "ariali.ttf", boldItalic: "arialbi.ttf" },
};
if (!existsSync(join(fontDir, "times.ttf"))) throw new Error(`Windows fonts were not found in ${fontDir}. Set WINDOWS_FONTS.`);
const customFonts = new Map(Object.entries(files).map(([family, faces]) => [family.toLowerCase(), {
  family, faces: Object.fromEntries(Object.entries(faces).map(([face, file]) => [face, { bytes: new Uint8Array(readFileSync(join(fontDir, file))), subset: true }])),
}]));
const shapes = Object.values(files).flatMap(faces => Object.values(faces)).map(file => fontkit.create(readFileSync(join(fontDir, file))));
const tolerance = 0.03; // outline coordinates are rounded when iText writes them
const key = run => `${run.text.trim()}@${run.x.toFixed(2)},${run.y.toFixed(2)}`;
const union = boxes => boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));

function outlineBox(run, font) {
  const layout = font.layout(run.text, { kern: false, liga: false });
  let x = 0;
  const boxes = [];
  for (const [index, glyph] of layout.glyphs.entries()) {
    const box = glyph.cbox;
    if (box.maxX > box.minX) boxes.push({ x0: x + box.minX, y0: box.minY, x1: x + box.maxX, y1: box.maxY });
    x += layout.positions[index].xAdvance;
  }
  const scale = run.size / font.unitsPerEm;
  const box = union(boxes);
  return { x0: run.x + box.x0 * scale, y0: run.y + box.y0 * scale, x1: run.x + box.x1 * scale, y1: run.y + box.y1 * scale };
}

let failed = 0;
const only = process.argv.slice(2);
for (const name of readdirSync(caseDir).filter(file => file.endsWith(".udf")).map(file => file.slice(0, -4)).filter(name => !only.length || only.includes(name))) {
  const output = join(referenceDir, `${name}.numbers.json`);
  const reference = await readLayout(readFileSync(join(referenceDir, `${name}.pdf`)));
  const ours = await readLayout((await convertUdf(new Uint8Array(readFileSync(join(caseDir, `${name}.udf`))), { customFonts })).bytes);
  const numbers = [];
  const problems = [];
  for (const [index, page] of ours.entries()) {
    const other = reference[index];
    if (!other) break;
    const words = new Set(other.runs.filter(run => run.text.trim()).map(key));
    const extra = page.runs.filter(run => run.text.trim() && !words.has(key(run)));
    const outlines = other.fills.filter(box => box.color !== "255,255,255");
    for (const run of extra) {
      const fits = shapes.map(font => outlineBox(run, font))
        .map(box => ({ box, match: outlines.find(fill => Math.max(Math.abs(fill.x0 - box.x0), Math.abs(fill.y0 - box.y0), Math.abs(fill.x1 - box.x1), Math.abs(fill.y1 - box.y1)) <= tolerance) }))
        .find(entry => entry.match);
      if (!fits) problems.push(`page ${index + 1}: ${JSON.stringify(run.text)} @${run.x.toFixed(2)},${run.y.toFixed(2)} has no matching UYAP outline`);
      else numbers.push({ page: index + 1, text: run.text, x: +run.x.toFixed(3), y: +run.y.toFixed(3), size: run.size, outline: Object.fromEntries(Object.entries(fits.match).filter(([field]) => field !== "color").map(([field, value]) => [field, +value.toFixed(3)])) });
    }
  }
  if (problems.length) {
    failed++;
    console.log(`FAIL ${name}`);
    for (const problem of problems.slice(0, 8)) console.log(`     ${problem}`);
  } else if (numbers.length) {
    writeFileSync(output, `${JSON.stringify(numbers, null, 1)}\n`);
    console.log(`OK   ${name}: ${numbers.length} page numbers`);
  } else if (existsSync(output)) rmSync(output);
}
process.exitCode = failed ? 1 : 0;
