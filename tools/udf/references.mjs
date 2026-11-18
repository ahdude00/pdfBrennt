// Exports each synthetic UDF with the installed UYAP Editör (Java 8) to test/udf/reference.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compile, runJava8, toolDir, uyapJar } from "./java.mjs";

const root = join(toolDir, "..", "..");
const caseDir = join(root, "test", "udf", "cases");
const referenceDir = join(root, "test", "udf", "reference");
if (!existsSync(uyapJar)) throw new Error(`UYAP Editör was not found at ${uyapJar}. Set UYAP_EDITOR_JAR.`);
mkdirSync(referenceDir, { recursive: true });

const only = process.argv.slice(2);
const pairs = readdirSync(caseDir).filter(name => name.endsWith(".udf"))
  .filter(name => !only.length || only.includes(name.replace(/\.udf$/, "")))
  .flatMap(name => [join(caseDir, name), join(referenceDir, name.replace(/\.udf$/, ".pdf"))]);
compile("UdfRef.java");
let output;
try {
  output = runJava8("UdfRef", pairs, [uyapJar]);
} catch (error) {
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  process.exitCode = 1;
}
console.log(output.split(/\r?\n/).filter(line => /^(OK|FAIL)|Exception|^\s+at tr\./.test(line)).join("\n"));
