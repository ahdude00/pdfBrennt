import { readFileSync } from "node:fs";
import { readLayout } from "./pdf-layout.mjs";
const pages = await readLayout(readFileSync(process.argv[2]));
const lim = Number(process.argv[3] ?? 40);
const f = v => typeof v === "number" ? +v.toFixed(2) : v;
for (const [i, p] of pages.entries()) {
  console.log(`page ${i + 1} ${f(p.width)}x${f(p.height)} runs=${p.runs.length} images=${p.images.length} strokes=${p.strokes.length} fills=${p.fills.length}`);
  for (const w of p.runs.slice(0, lim)) console.log(`  ${f(w.x)} ${f(w.y)} s${f(w.size)} w${f(w.width)} ${JSON.stringify(w.text)}${w.color !== "0,0,0" ? " c" + w.color : ""}`);
  for (const im of p.images) console.log("  IMG", JSON.stringify(im, (k, v) => f(v)));
  for (const s of p.strokes.slice(0, lim)) console.log("  STROKE", JSON.stringify(s, (k, v) => f(v)));
  for (const s of p.fills.slice(0, 10)) console.log("  FILL", JSON.stringify(s, (k, v) => f(v)));
}
