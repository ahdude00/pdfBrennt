import { unzipSync } from "fflate";
import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import regularUrl from "./udf-fonts/LiberationSerif-Regular.ttf?url";
import boldUrl from "./udf-fonts/LiberationSerif-Bold.ttf?url";
import italicUrl from "./udf-fonts/LiberationSerif-Italic.ttf?url";
import boldItalicUrl from "./udf-fonts/LiberationSerif-BoldItalic.ttf?url";

// Paragraph layout is adapted from egPDF's MIT-licensed UDF renderer.
// Upstream: acc-studio/egpdf at c14775fd388cc49c5e9884d4a1b01340261ae0ec.
// Redistribution notices are in public/licenses.

const fontUrls = { regular: regularUrl, bold: boldUrl, italic: italicUrl, boldItalic: boldItalicUrl };
const maxFileBytes = 8 * 1024 * 1024;
const maxTextCharacters = 100000;
const maxArchiveEntries = 16;
const formatFields = ["family", "size", "bold", "italic", "underline", "foreground", "background"];
const paragraphFields = ["Alignment", "LeftIndent", "RightIndent", "FirstLineIndent", "SpaceAbove", "SpaceBelow", "LineSpacing"];
const unsupported = "Bu UDF, beta sürümün desteklediği metin düzeninin dışında. PDF çıktısını UYAP Editör ile oluşturabilirsiniz.";

function fail(message = unsupported) {
  throw new Error(message);
}

function attributes(element, allowed) {
  const result = {};
  for (const attribute of element.attributes) {
    if (!allowed.includes(attribute.name)) fail();
    result[attribute.name] = attribute.value;
  }
  return result;
}

function number(value, fallback, min = 0, max = 1000) {
  if (value == null) return fallback;
  const result = value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(result) || result < min || result > max) fail();
  return result;
}

async function readUdf(file) {
  if (!file.size || file.size > maxFileBytes) fail("8 MB veya daha küçük, geçerli bir UDF seçin.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    fail("UDF paketi okunamadı.");
  }
  const entries = [];
  let zip;
  try {
    zip = unzipSync(bytes, { filter: entry => {
      if (entries.length >= maxArchiveEntries) fail();
      entries.push(entry);
      return entry.name === "content.xml" && entry.originalSize <= maxFileBytes;
    } });
  } catch {
    fail("UDF paketi okunamadı.");
  }
  if (entries.some(entry => /(?:^|\/)sign\.sgn$/i.test(entry.name))) {
    fail("Bu UDF e-imza içeriyor. İmzalı özgün belgeyi UYAP Editör ile açın.");
  }
  if (entries.some(entry => entry.name !== "content.xml" && !entry.name.endsWith("/"))) fail();
  const contentEntries = entries.filter(entry => entry.name === "content.xml");
  if (contentEntries.length !== 1 || !zip["content.xml"]) fail("UDF paketi okunamadı.");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(zip["content.xml"]);
  } catch {
    fail("UDF belgesinin metni okunamadı.");
  }
  if (/<!DOCTYPE/i.test(source)) fail("UDF belgesinin XML tanımı desteklenmiyor.");
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.querySelector("parsererror")) fail("UDF belgesinin XML içeriği okunamadı.");
  return xml.documentElement;
}

function getSection(parent, name, required = true) {
  const matches = [...parent.children].filter(child => child.tagName === name);
  if (matches.length > 1 || (required && !matches.length)) fail();
  return matches[0];
}

function parseDocument(root) {
  if (root.tagName !== "template" || attributes(root, ["format_id"]).format_id !== "1.8") fail();
  const sections = ["content", "properties", "styles", "elements"];
  if ([...root.children].some(child => !sections.includes(child.tagName))) fail();
  const textElement = getSection(root, "content");
  if (textElement.children.length) fail();
  const text = textElement.textContent;
  if (text.length > maxTextCharacters) fail("Bu UDF beta sürümünün metin sınırını aşıyor.");
  const properties = getSection(root, "properties");
  const pageFormat = getSection(properties, "pageFormat");
  if (properties.children.length !== 1 || pageFormat.children.length) fail();
  const { mediaSizeName, paperOrientation, leftMargin, rightMargin, topMargin, bottomMargin } = attributes(pageFormat, [
    "mediaSizeName", "paperOrientation", "leftMargin", "rightMargin", "topMargin", "bottomMargin", "headerFOffset", "footerFOffset",
  ]);
  if ((mediaSizeName ?? "1") !== "1" || (paperOrientation ?? "1") !== "1") fail();
  const dimensions = PageSizes.A4;
  const margins = [
    number(leftMargin, 42.52), number(rightMargin, 28.35),
    number(topMargin, 14.17), number(bottomMargin, 14.17),
  ];
  if (margins[0] + margins[1] > dimensions[0] - 48 || margins[2] + margins[3] > dimensions[1] - 48) fail();

  const styles = new Map();
  const styleSection = getSection(root, "styles", false);
  for (const style of styleSection?.children ?? []) {
    if (style.tagName !== "style" || style.children.length) fail();
    const fields = attributes(style, ["name", "description", "FONT_ATTRIBUTE_KEY", ...formatFields, ...paragraphFields]);
    if (!fields.name || styles.has(fields.name)) fail();
    styles.set(fields.name, fields);
  }
  const elements = getSection(root, "elements");
  const { resolver } = attributes(elements, ["resolver"]);
  const resolve = name => {
    if (!name) return {};
    if (!styles.has(name)) fail();
    return styles.get(name);
  };
  const defaults = { ...resolve(styles.has("hvl-default") ? "hvl-default" : null), ...resolve(resolver) };
  const blocks = [];
  let textCursor = 0;
  const ignorable = value => /^[\s\u200b]*$/u.test(value);
  for (const block of elements.children) {
    const isBreak = block.tagName === "page-break";
    if (!isBreak && block.tagName !== "paragraph") fail();
    if (isBreak) attributes(block, []);
    const paragraph = isBreak ? getSection(block, "paragraph", false) : block;
    if (isBreak && block.children.length > 1) fail();
    const fields = paragraph ? attributes(paragraph, ["resolver", "description", ...formatFields, ...paragraphFields]) : {};
    const settings = { ...defaults, ...resolve(fields.resolver), ...fields };
    const runs = [];
    for (const run of paragraph?.children ?? []) {
      if (!["content", "space"].includes(run.tagName) || run.children.length) fail();
      const fields = attributes(run, ["resolver", "description", "startOffset", "length", ...formatFields]);
      const start = number(fields.startOffset, NaN, 0, text.length);
      const length = number(fields.length, NaN, 0, text.length);
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < textCursor || start + length > text.length) fail();
      if (runs.length && start !== textCursor) fail();
      if (!ignorable(text.slice(textCursor, start))) fail();
      textCursor = start + length;
      runs.push({ text: text.slice(start, textCursor), style: { ...settings, ...resolve(fields.resolver), ...fields } });
    }
    if (isBreak) {
      if (runs.some(run => !ignorable(run.text))) fail();
      blocks.push({ break: true });
      continue;
    }
    const paragraphText = runs.map(run => run.text).join("").replace(/[\r\n]+$/u, "");
    if (/[\u0000-\u001f\u00a0\u202a-\u202e\u2066-\u2069]/u.test(paragraphText)) fail();
    blocks.push({ settings, runs });
  }
  if (!ignorable(text.slice(textCursor)) || ignorable(text) || !blocks.length) fail();
  return { dimensions, margins, blocks };
}

function styleFace(style) {
  if (style.family && !/^(times new roman|liberation serif|serif)$/i.test(style.family)) fail();
  if (style.background != null && !["-1", "16777215", "0"].includes(style.background)) fail();
  const bold = style.bold === "true";
  const italic = style.italic === "true";
  if (bold && italic) return "boldItalic";
  return bold ? "bold" : italic ? "italic" : "regular";
}

function styleColor(value) {
  const color = number(value, -16777216, -2147483648, 4294967295) >>> 0;
  return rgb(((color >>> 16) & 255) / 255, ((color >>> 8) & 255) / 255, (color & 255) / 255);
}

async function layoutParagraph(block, width, getFont) {
  const { settings, runs } = block;
  const align = number(settings.Alignment, 0, 0, 2);
  if (!Number.isInteger(align)) fail();
  const left = number(settings.LeftIndent, 0, 0, width - 24);
  const right = number(settings.RightIndent, 0, 0, width - left - 24);
  const firstIndent = number(settings.FirstLineIndent, 0, -left, width - right - left - 24);
  const spacing = number(settings.LineSpacing, 0, 0, 3);
  const above = number(settings.SpaceAbove, 0, 0, 250);
  const below = number(settings.SpaceBelow, 0, 0, 250);
  const baseSize = number(settings.size, 12, 1, 96);
  const lines = [];
  let line;
  function startLine() {
    const indent = left + (lines.length ? 0 : firstIndent);
    line = { items: [], used: 0, maxSize: 0, indent, available: width - indent - right };
    lines.push(line);
  }
  function add(piece, style, advance) {
    line.items.push({ piece, ...style, advance, x: line.used });
    line.used += advance;
    line.maxSize = Math.max(line.maxSize, style.size);
  }
  startLine();
  for (const run of runs) {
    const text = run.text.replace(/[\r\n\u200b]/gu, "");
    if (!text) continue;
    const { font, characters } = await getFont(styleFace(run.style));
    if ([...text].some(character => !characters.has(character.codePointAt(0)))) {
      fail("UDF belgesindeki bazı karakterler beta sürümde desteklenmiyor. UYAP Editör ile PDF oluşturabilirsiniz.");
    }
    const style = {
      size: number(run.style.size, baseSize, 1, 96),
      color: styleColor(run.style.foreground), font, underline: run.style.underline === "true",
    };
    for (const piece of text.match(/ +|[^ ]+/gu) ?? []) {
      const space = piece.startsWith(" ");
      const advance = font.widthOfTextAtSize(piece, style.size);
      if (!space && line.used + advance > line.available && line.items.some(item => item.piece.trim())) {
        if (!line.items.at(-1)?.piece.endsWith(" ")) fail();
        startLine();
      }
      if (space && !line.items.length && lines.length > 1) continue;
      if (advance > line.available || (!space && line.used + advance > line.available)) fail();
      add(piece, style, advance);
    }
  }
  for (const line of lines) {
    while (line.items.length && !line.items.at(-1).piece.trim()) line.used -= line.items.pop().advance;
    const size = line.maxSize || baseSize;
    line.ascent = size * 0.891;
    line.height = size * 1.15 * (1 + spacing);
    line.x = line.indent + (line.available - line.used) * (align === 1 ? 0.5 : align === 2 ? 1 : 0);
  }
  return { above, below, lines };
}

export async function udfToPdf(file) {
  const { dimensions: [width, height], margins: [left, right, top, bottom], blocks } = parseDocument(await readUdf(file));
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fonts = new Map();
  async function getFont(face) {
    if (!fonts.has(face)) {
      const response = await fetch(fontUrls[face]);
      if (!response.ok) fail("UDF yazı tipi yüklenemedi. Yeniden deneyin.");
      const font = await document.embedFont(await response.arrayBuffer(), { subset: true });
      fonts.set(face, { font, characters: new Set(font.getCharacterSet()) });
    }
    return fonts.get(face);
  }

  let page;
  let y;
  function newPage() {
    if (document.getPageCount() >= 100) fail("Bu UDF beta sürümünün 100 sayfa sınırını aşıyor.");
    page = document.addPage([width, height]);
    y = height - top;
  }
  newPage();
  for (const block of blocks) {
    if (block.break) {
      newPage();
      continue;
    }
    const paragraph = await layoutParagraph(block, width - left - right, getFont);
    y -= paragraph.above;
    for (const line of paragraph.lines) {
      // The verified beta scope uses page breaks written into the document.
      // Stop before emitting a PDF if the layout needs an inferred page break.
      if (y - line.height < bottom) fail();
      const baseline = y - line.ascent;
      for (const item of line.items) {
        const x = left + line.x + item.x;
        page.drawText(item.piece, { x, y: baseline, size: item.size, font: item.font, color: item.color });
        if (item.underline) {
          const underlineY = baseline - item.size * 0.12;
          page.drawLine({ start: { x, y: underlineY }, end: { x: x + item.advance, y: underlineY }, thickness: 0.5, color: item.color });
        }
      }
      y -= line.height;
    }
    y -= paragraph.below;
  }
  document.setProducer("PDF Brennt");
  return {
    bytes: await document.save(),
    mimeType: "application/pdf",
    pageCount: document.getPageCount(),
    fileCount: 1,
    warnings: ["Times New Roman yerine metrik uyumlu Liberation Serif kullanıldı. Sayfa düzenini önizlemede kontrol edin."],
  };
}
