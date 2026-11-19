// Compiles the PDF Brennt köprüsü (bridge/PdfBrenntKopru.java) for Java 8 and writes
// public/kopru/pdfbrennt-kopru.jar, which the site offers for download.
// It needs a JDK: JAVA_HOME, a JDK under C:/Program Files/Java, or javac on PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";

const bridgeDir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const root = join(bridgeDir, "..");
const output = join(root, "public", "kopru", "pdfbrennt-kopru.jar");
const exe = process.platform === "win32" ? ".exe" : "";

function findJavac() {
  const home = process.env.JAVA_HOME;
  if (home && existsSync(join(home, "bin", `javac${exe}`))) return join(home, "bin", `javac${exe}`);
  const windowsRoot = "C:/Program Files/Java";
  if (process.platform === "win32" && existsSync(windowsRoot)) {
    const jdk = readdirSync(windowsRoot).filter(name => /^jdk/.test(name)).sort().at(-1);
    if (jdk && existsSync(join(windowsRoot, jdk, "bin", "javac.exe"))) return join(windowsRoot, jdk, "bin", "javac.exe");
  }
  return `javac${exe}`;
}

const classes = mkdtempSync(join(tmpdir(), "pdfbrennt-kopru-"));
try {
  execFileSync(findJavac(), ["-nowarn", "-encoding", "UTF-8", "--release", "8", "-d", classes, join(bridgeDir, "PdfBrenntKopru.java")],
    { stdio: ["ignore", "inherit", "inherit"] });
  // A fixed timestamp keeps the jar identical between builds of the same source.
  const mtime = new Date("2026-01-01T00:00:00Z");
  const files = { "META-INF/MANIFEST.MF": [strToU8("Manifest-Version: 1.0\r\nMain-Class: PdfBrenntKopru\r\nCreated-By: PDF Brennt\r\n\r\n"), { mtime }] };
  for (const name of readdirSync(classes).filter(file => file.endsWith(".class")).sort()) files[name] = [readFileSync(join(classes, name)), { mtime }];
  mkdirSync(join(root, "public", "kopru"), { recursive: true });
  writeFileSync(output, zipSync(files, { level: 9 }));
  console.log(`${output} (${(readFileSync(output).length / 1024).toFixed(1)} KiB)`);
} finally {
  rmSync(classes, { recursive: true, force: true });
}
