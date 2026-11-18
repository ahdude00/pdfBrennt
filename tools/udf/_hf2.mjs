import { renderSet, printLayout } from "./probe-set.mjs";
const body = d => Array.from({ length: 3 }, (_, i) => d.paragraph({}, [`Satır ${i + 1}`]));
const sets = {
  hfSpec1: d => d.build([...body(d), d.footer({ "pageNumber-spec": "1" }, [d.paragraph({}, [""])])]),
  hfSpec0: d => d.build([...body(d), d.footer({ "pageNumber-spec": "0" }, [d.paragraph({}, [""])])]),
  hfSpec5: d => d.build([...body(d), d.footer({ "pageNumber-spec": "5" }, [d.paragraph({}, [""])])]),
  hfHeaderTall: d => d.build([d.header({}, [d.paragraph({}, ["Üst 1"]), d.paragraph({}, ["Üst 2"]), d.paragraph({}, ["Üst 3"]), d.paragraph({}, ["Üst 4"])]), ...body(d)]),
};
const results = await renderSet(sets);
for (const [name, pages] of Object.entries(results)) printLayout(name, pages);
