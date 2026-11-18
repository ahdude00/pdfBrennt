// Verifies the row model in src/udf/metrics.js against UYAP Editör for every
// family, face and size: a 400 pt inline image makes the row taller, and the text
// must start at trunc((rowHeight - height) * align) with the image gap UYAP adds.
// Usage: node tools/udf/alignment.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { renderProbe } from "./probe.mjs";
import { toolDir } from "./java.mjs";
import { measureFont } from "../../src/udf/metrics.js";

const root = join(toolDir, "..", "..");
const files = { "times new roman": "LiberationSerif", arial: "LiberationSans" };
const faceFiles = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "BoldItalic" };
const pages = await renderProbe("alignment");
let index = 0;
let checked = 0;
const problems = [];
for (const family of ["Times New Roman", "Arial"]) for (const face of ["regular", "bold", "italic", "boldItalic"]) for (let size = 1; size <= 96; size++) {
  const page = pages[index++];
  const key = family.toLowerCase();
  const metrics = fontkit.create(readFileSync(join(root, "src", "udf-fonts", `${files[key]}-${faceFiles[face]}.ttf`)));
  const measure = measureFont({ metrics, familyKey: key, face, size, exact: true });
  const refs = page?.runs.filter(run => run.text === "R").map(run => run.y).sort((a, b) => b - a) ?? [];
  const aa = page?.runs.find(run => run.text === "Aa");
  const image = page?.images[0];
  if (refs.length !== 2 || !aa || !image) continue;
  const top = refs[0] - 3;
  const rowHeight = Math.round(top - (refs[1] + 11));
  const gap = Math.round(top - image.y - image.height);
  const baseline = Math.round(top - aa.y);
  const expectedHeight = Math.max(measure.height, 400 + measure.gap);
  const expectedBaseline = Math.trunc((expectedHeight - measure.height) * measure.align) + measure.ascent;
  checked++;
  if (rowHeight !== expectedHeight || gap !== measure.gap || baseline !== expectedBaseline) {
    problems.push(`${family} ${face} ${size}: row ${rowHeight}/${expectedHeight} gap ${gap}/${measure.gap} baseline ${baseline}/${expectedBaseline}`);
  }
}
console.log(`${checked - problems.length}/${checked} sizes match`);
for (const problem of problems.slice(0, 20)) console.log(problem);
process.exitCode = problems.length ? 1 : 0;
