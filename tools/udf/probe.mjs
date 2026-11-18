// Layout probes: renders small documents with UYAP Editör and prints measured positions.
// Usage: node tools/udf/probe.mjs <probe name>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, runJava8, toolDir, uyapJar, buildDir } from "./java.mjs";
import { createDocument } from "./udf-builder.mjs";
import { readLayout } from "./pdf-layout.mjs";

const families = ["Times New Roman", "Arial"];
const faces = [{}, { bold: "true" }, { italic: "true" }, { bold: "true", italic: "true" }];
const faceNames = ["regular", "bold", "italic", "boldItalic"];

export const probes = {
  // One reference line, then a two-line paragraph at the probed size.
  lines(d) {
    const blocks = [];
    for (const family of families) for (const [index, face] of faces.entries()) for (let size = 6; size <= 40; size++) {
      blocks.push(d.paragraph({}, [{ text: `R ${family}|${faceNames[index]}|${size}` }]));
      blocks.push(d.paragraph({}, [{ text: "Hg ".repeat(Math.ceil(1400 / size)).trim(), family, size: String(size), ...face }]));
    }
    blocks.push(d.paragraph({}, ["R end"]));
    return d.build(blocks);
  },
  // Inline images of many heights next to text.
  images(d) {
    const stamp = readFileSync(join(toolDir, "..", "..", "test", "udf", "assets", "stamp.png"));
    const blocks = [];
    for (const size of [8, 12, 16]) for (const height of [3, 5, 7, 9, 10, 11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 33, 37, 41, 45, 50, 55, 61]) {
      blocks.push(d.paragraph({}, [{ text: `R ${size}/${height}` }]));
      blocks.push(d.paragraph({}, [{ text: "Aa ", size: String(size) }, { image: stamp, width: 10, height }, { text: " Bb", size: String(size) }]));
    }
    blocks.push(d.paragraph({}, ["R end"]));
    return d.build(blocks);
  },
  // Tall inline images next to text of every size, one row per page.
  imageSizes(d) {
    const stamp = readFileSync(join(toolDir, "..", "..", "test", "udf", "assets", "stamp.png"));
    const blocks = [];
    for (const family of families) for (let size = 6; size <= 40; size += 1) for (const height of [100, 400]) {
      blocks.push(d.paragraph({}, [{ text: `R ${family} ${size} ${height}` }]));
      blocks.push(d.paragraph({}, [{ text: "Aa ", size: String(size), family }, { image: stamp, width: 10, height }, { text: " Bb\n".slice(0, 3), size: String(size), family }]));
      blocks.push(d.paragraph({}, ["R"]));
      blocks.push(d.pageBreak());
    }
    blocks.push(d.paragraph({}, ["R end"]));
    return d.build(blocks);
  },
  // Alignment of text of every family, face and size against a 400 pt image.
  alignment(d) {
    const stamp = readFileSync(join(toolDir, "..", "..", "test", "udf", "assets", "stamp.png"));
    const blocks = [];
    for (const family of families) for (const face of faces) for (let size = 1; size <= 96; size++) {
      blocks.push(d.paragraph({}, ["R"]));
      blocks.push(d.paragraph({}, [{ image: stamp, width: 10, height: 400 }, { text: " Aa", size: String(size), family, ...face }]));
      blocks.push(d.paragraph({}, ["R"]));
      blocks.push(d.pageBreak());
    }
    return d.build(blocks);
  },
  // Two sizes on one line.
  mixed(d) {
    const blocks = [];
    for (const [a, b] of [[10, 16], [12, 8], [8, 12], [12, 14], [14, 10], [11, 12], [12, 20], [20, 9], [9, 13], [13, 15]]) {
      blocks.push(d.paragraph({}, [{ text: `R ${a}/${b}` }]));
      blocks.push(d.paragraph({}, [{ text: "Aa ", size: String(a) }, { text: "Bb", size: String(b) }]));
      blocks.push(d.paragraph({}, [{ text: "Aa ", size: String(a), family: "Arial" }, { text: "Bb", size: String(b) }]));
    }
    blocks.push(d.paragraph({}, ["R end"]));
    return d.build(blocks);
  },
};

export async function renderProbe(name, build = probes[name], page) {
  const dir = join(buildDir, "probes");
  mkdirSync(dir, { recursive: true });
  const udf = join(dir, `${name}.udf`);
  const pdf = join(dir, `${name}.pdf`);
  writeFileSync(udf, build(createDocument(page ? { page } : {})));
  compile("UdfRef.java");
  runJava8("UdfRef", [udf, pdf], [uyapJar]);
  return readLayout(readFileSync(pdf));
}

if (process.argv[1]?.endsWith("probe.mjs")) {
  const name = process.argv[2];
  const pages = await renderProbe(name);
  const f = value => +value.toFixed(2);
  for (const [index, page] of pages.entries()) {
    console.log(`page ${index + 1} ${f(page.width)}x${f(page.height)}`);
    for (const run of page.runs) if (run.text.trim()) console.log(`${f(run.x)}\t${f(run.y)}\t${f(run.size)}\t${run.text}`);
  }
}
