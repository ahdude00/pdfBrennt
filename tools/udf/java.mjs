import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const toolDir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
export const buildDir = join(toolDir, "..", "..", "node_modules", ".cache", "udf-tools");

const javaRoot = "C:/Program Files/Java";

function findJava8() {
  const home = process.env.JAVA8_HOME;
  if (home) return join(home, "bin", "java.exe");
  const root = javaRoot;
  const jre = existsSync(root) && readdirSync(root).filter(name => /^(jre|jdk)1\.8\.0_\d+$/.test(name)).sort().at(-1);
  if (!jre) throw new Error("Java 8 runtime not found. Set JAVA8_HOME.");
  return join(root, jre, "bin", "java.exe");
}

function findJavac() {
  const root = javaRoot;
  const jdk = existsSync(root) && readdirSync(root).filter(name => /^jdk-\d+/.test(name)).sort().at(-1);
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin", "javac.exe"))) return join(process.env.JAVA_HOME, "bin", "javac.exe");
  if (!jdk) throw new Error("A JDK with javac was not found. Set JAVA_HOME.");
  return join(root, jdk, "bin", "javac.exe");
}

export const uyapJar = process.env.UYAP_EDITOR_JAR ?? "C:/UYAP/Uyap Kelime Islemci/editor-app.jar";

export function compile(...sources) {
  mkdirSync(buildDir, { recursive: true });
  execFileSync(findJavac(), ["-nowarn", "-encoding", "UTF-8", "--release", "8", "-d", buildDir, ...sources.map(name => join(toolDir, name))], { stdio: ["ignore", "ignore", "inherit"] });
}

export function runJava8(mainClass, args, classPath = []) {
  return execFileSync(findJava8(), [
    "-Dfile.encoding=UTF-8", "-Dsun.java2d.dpiaware=false", "-Dsun.java2d.uiScale=1", "-Dlogback.configurationFile=" + join(toolDir, "quiet-logback.xml"),
    "-cp", [buildDir, ...classPath].join(";"), mainClass, ...args,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
