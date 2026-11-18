import { renderSet } from "./probe-set.mjs";
const body = (d, n) => Array.from({ length: n }, (_, i) => d.paragraph({}, [`Satır ${i + 1}`]));
const sets = {
  footTall: d => d.build([...body(d, 70), d.footer({}, [d.paragraph({}, ["Alt 1"]), d.paragraph({}, ["Alt 2"]), d.paragraph({}, ["Alt 3"]), d.paragraph({}, ["Alt 4"])])]),
  footOne: d => d.build([...body(d, 70), d.footer({}, [d.paragraph({}, ["Alt 1"])])]),
  margins: d => d.build([d.header({}, [d.paragraph({}, ["Üst 1"])]), ...body(d, 70), d.footer({}, [d.paragraph({}, ["Alt 1"])])]),
  offsets: d => d.build([d.header({}, [d.paragraph({}, ["Üst 1"])]), ...body(d, 70), d.footer({}, [d.paragraph({}, ["Alt 1"]), d.paragraph({}, ["Alt 2"])])]),
};
const options = { margins: { page: { leftMargin: "70.86614", rightMargin: "28.346457", topMargin: "56.692913", bottomMargin: "30.0" } },
  offsets: { page: { headerFOffset: "35.5", footerFOffset: "12.3", topMargin: "28.3", bottomMargin: "70.1" } } };
const results = await renderSet(sets, options);
for (const [name, pages] of Object.entries(results)) {
  if (pages.error) { console.log(name, pages.error); continue; }
  for (const [i, p] of pages.entries()) {
    const lines = [...new Map(p.runs.filter(r => r.text.trim()).map(r => [r.y.toFixed(2), r])).values()];
    const body = lines.filter(r => r.text === "Satır");
    const hf = lines.filter(r => r.text !== "Satır");
    console.log(`${name} p${i + 1}/${pages.length} H=${p.height.toFixed(2)} bodyFirst=${body[0]?.y.toFixed(2)} bodyLast=${body.at(-1)?.y.toFixed(2)} n=${body.length} hf=${hf.map(r => r.text + "@" + r.x + "," + r.y.toFixed(2)).join(" ")}`);
  }
}
