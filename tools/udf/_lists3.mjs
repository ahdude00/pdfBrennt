import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { renderSet } from "./probe-set.mjs";
import java from "../../src/udf/java-metrics.js";
const fonts = { "times new roman": fontkit.create(readFileSync("src/udf-fonts/LiberationSerif-Regular.ttf")), arial: fontkit.create(readFileSync("src/udf-fonts/LiberationSans-Regular.ttf")) };
const sets = {};
for (const family of ["Times New Roman", "Arial"]) {
  sets[family.replace(/ /g, "") + "N"] = d => d.build(Array.from({ length: 35 }, (_, i) => d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: String(i + 1), ListLevel: "0", size: String(i + 6), family }, [{ text: "Hg", size: String(i + 6), family }])));
  sets[family.replace(/ /g, "") + "B"] = d => d.build(Array.from({ length: 35 }, (_, i) => d.paragraph({ Bulleted: "true", BulletType: "BULLET_TYPE_ELLIPSE", ListId: String(i + 1), ListLevel: "0", size: String(i + 6), family }, [{ text: "Hg", size: String(i + 6), family }])));
}
const results = await renderSet(sets);
for (const [name, pages] of Object.entries(results)) {
  const family = name.startsWith("Times") ? "times new roman" : "arial";
  const font = fonts[family];
  const runs = pages.flatMap((p, pi) => p.runs.map(r => ({ ...r, page: pi })));
  const fills = pages.flatMap((p, pi) => p.fills.map(f => ({ ...f, page: pi })));
  const hg = runs.filter(r => r.text === "Hg");
  const out = [];
  for (const [i, r] of hg.entries()) {
    const size = Math.round(r.size);
    const sc = size / font.unitsPerEm;
    const H = Math.ceil((font.ascent - font.descent + font.lineGap) * sc);
    const [jA, jD, jL] = java.fonts[family].regular[size - 1];
    const top = r.y + jA + jL;
    if (name.endsWith("N")) {
      const m = runs.find(x => x.page === r.page && /^\d+\.$/.test(x.text) && Math.abs(x.y - r.y) < 6);
      out.push(`${size}:${m ? +(top - m.y).toFixed(2) : "?"}/${jA + jL}/H${H}/x${m?.x}`);
    } else {
      const f = fills.find(x => x.page === r.page && Math.abs(x.y0 - r.y) < 10 && x.x1 < r.x);
      out.push(`${size}:${f ? `${+(f.x0).toFixed(1)},${+(top - f.y1).toFixed(1)},${+(f.x1 - f.x0).toFixed(1)}x${+(f.y1 - f.y0).toFixed(1)}` : "?"}/H${H}`);
    }
  }
  console.log(name, out.join(" "));
}
