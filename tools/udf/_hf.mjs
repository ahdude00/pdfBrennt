import { renderSet, printLayout } from "./probe-set.mjs";
import { filler } from "./udf-builder.mjs";
const body = d => Array.from({ length: 70 }, (_, i) => d.paragraph({}, [`Satır ${i + 1}`]));
const sets = {
  hfText: d => d.build([d.header({}, [d.paragraph({}, ["Üst bilgi metni"])]), ...body(d), d.footer({}, [d.paragraph({ Alignment: "1" }, ["Alt bilgi metni"])])]),
  hfSpec1: d => d.build([...body(d), d.footer({ "pageNumber-spec": "1" }, [d.paragraph({}, [""])])]),
  hfSpec2: d => d.build([...body(d), d.footer({ "pageNumber-spec": "2", "pageNumber-seperator": "/" }, [d.paragraph({}, [""])])]),
  hfSpecTrue: d => d.build([...body(d), d.footer({ "pageNumber-spec": "true" }, [d.paragraph({}, [""])])]),
};
const results = await renderSet(sets);
for (const [name, pages] of Object.entries(results)) {
  if (pages.error) { console.log(name, pages.error); continue; }
  for (const [i, p] of pages.entries()) {
    const runs = p.runs.filter(r => r.text.trim() && !/^Satır$|^\d+$/.test(r.text.trim()) || r.y < 60 || r.y > 800);
    console.log(`== ${name} p${i + 1}/${pages.length}`, runs.map(r => `${r.text}@${r.x.toFixed(2)},${r.y.toFixed(2)},${r.size}`).join(" | "), "strokes", p.strokes.length, "fills", p.fills.length);
  }
}
