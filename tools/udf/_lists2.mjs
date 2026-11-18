import { renderSet, printLayout } from "./probe-set.mjs";
const types = ["NUMBER_TYPE_NUMBER_DOT","NUMBER_TYPE_NUMBER_PARANTHESE","NUMBER_TYPE_NUMBER_D_PARANTHESE","NUMBER_TYPE_NUMBER_TRE","NUMBER_TYPE_CHAR_SMALL_DOT","NUMBER_TYPE_CHAR_BIG_PARANTHESE","NUMBER_TYPE_ROMAN_SMALL_DOT","NUMBER_TYPE_ROMAN_BIG_TRE","NUMBER_TYPE_NUMBER_DOT_2","NUMBER_TYPE_CHAR_BIG_2"];
const sets = {};
types.forEach((type, i) => { sets[`n${i}`] = d => d.build(Array.from({ length: 11 }, (_, k) => d.paragraph({ Numbered: "true", NumberType: type, ListId: "1", ListLevel: "0" }, [`Öğe ${k + 1}`]))); });
sets.indent = d => d.build([0, 18, 36, 72].map(li => d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: String(li + 1), ListLevel: "0", LeftIndent: String(li) }, [`Girinti ${li}`])));
sets.size = d => d.build([8, 12, 16, 24].map(s => d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: String(s), ListLevel: "0", size: String(s) }, [{ text: `Punto ${s}`, size: String(s) }])));
sets.bullets = d => d.build(["BULLET_TYPE_ELLIPSE","BULLET_TYPE_RECTANGLE","BULLET_TYPE_ARROW","BULLET_TYPE_DIAMOND","BULLET_TYPE_TRIANGLE","BULLET_TYPE_RECTANGLE_D","BULLET_TYPE_DIAMOND_2"].map((b, i) => d.paragraph({ Bulleted: "true", BulletType: b, ListId: String(i + 1), ListLevel: "0" }, [b])));
sets.wrap = d => d.build([d.paragraph({ Numbered: "true", NumberType: "NUMBER_TYPE_NUMBER_DOT", ListId: "1", ListLevel: "0", Alignment: "3" }, ["Uzun madde metni ".repeat(12)])]);
const results = await renderSet(sets);
for (const [name, pages] of Object.entries(results)) {
  if (pages.error) { console.log(name, pages.error); continue; }
  const p = pages[0];
  const markers = p.runs.filter(r => r.text.trim() && r.x < 43 || (name === "indent" || name === "size") && r.text.trim());
  console.log(`== ${name}:`, p.runs.filter(r => r.text.trim()).slice(0, 26).map(r => `${JSON.stringify(r.text)}@${r.x.toFixed(2)},${r.y.toFixed(2)}`).join(" "), p.fills.length ? "FILLS " + p.fills.map(f => `${f.x0.toFixed(1)},${f.y0.toFixed(1)}-${f.x1.toFixed(1)},${f.y1.toFixed(1)}`).join(" ") : "", p.strokes.length ? "STROKES " + p.strokes.map(f => `${f.x0.toFixed(1)},${f.y0.toFixed(1)}-${f.x1.toFixed(1)},${f.y1.toFixed(1)}`).join(" ") : "");
}
