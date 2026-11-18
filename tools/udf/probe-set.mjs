// Renders several small UDF documents with UYAP Editör in one run.
// Usage: import { renderSet } from "./probe-set.mjs"; await renderSet({ name: d => d.build([...]) }, { name: { page } })
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, runJava8, uyapJar, buildDir } from "./java.mjs";
import { createDocument } from "./udf-builder.mjs";
import { readLayout } from "./pdf-layout.mjs";

export async function renderSet(builders, options = {}) {
  const dir = join(buildDir, "probes");
  mkdirSync(dir, { recursive: true });
  const pairs = [];
  for (const [name, build] of Object.entries(builders)) {
    const udf = join(dir, `${name}.udf`);
    writeFileSync(udf, build(createDocument(options[name] ?? {})));
    pairs.push(udf, join(dir, `${name}.pdf`));
  }
  compile("UdfRef.java");
  let log = "";
  try { log = runJava8("UdfRef", pairs, [uyapJar]); } catch (error) { log = `${error.stdout ?? ""}`; }
  const results = {};
  for (const name of Object.keys(builders)) {
    const line = log.split(/\r?\n/).find(entry => entry.includes(`${name}.udf`) && /^(OK|FAIL)/.test(entry));
    results[name] = line?.startsWith("OK") ? await readLayout(readFileSync(join(dir, `${name}.pdf`))) : { error: line ?? "no output" };
  }
  return results;
}

export function printLayout(name, pages) {
  if (pages.error) return console.log(`== ${name}: ${pages.error}`);
  const f = value => +value.toFixed(2);
  for (const [index, page] of pages.entries()) {
    console.log(`== ${name} page ${index + 1} ${f(page.width)}x${f(page.height)}`);
    for (const run of page.runs) if (run.text.trim()) console.log(`  ${f(run.x)}\t${f(run.y)}\t${f(run.size)}\t${run.color}\t${run.text}`);
    for (const image of page.images) console.log(`  IMG ${f(image.x)},${f(image.y)} ${f(image.width)}x${f(image.height)}`);
    for (const box of page.strokes) console.log(`  STROKE ${f(box.x0)},${f(box.y0)}–${f(box.x1)},${f(box.y1)}`);
    for (const box of page.fills) console.log(`  FILL ${f(box.x0)},${f(box.y0)}–${f(box.x1)},${f(box.y1)} ${box.color}`);
  }
}
