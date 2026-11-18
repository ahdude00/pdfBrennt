import { unzipSync } from "fflate";
import {
  PDFDocument, PageSizes, beginText, endText, popGraphicsState, pushGraphicsState, rgb,
  setFillingColor, setFontAndSize, setTextMatrix, showText,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { udfFontFamilyKey } from "./udf-custom-fonts.js";
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
const parsedDocuments = new WeakMap();
const faceLabels = { regular: "normal", bold: "kalın", italic: "italik", boldItalic: "kalın italik" };
const defaultFontFamily = "Times New Roman";
const fallbackFontFamily = "Liberation Serif";
const formatFields = ["family", "size", "bold", "italic", "underline", "foreground", "background"];
const paragraphFields = ["Alignment", "LeftIndent", "RightIndent", "FirstLineIndent", "SpaceAbove", "SpaceBelow", "LineSpacing"];
const unsupported = "Bu UDF, beta sürümün desteklediği metin düzeninin dışında.";

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
    fail("Bu UDF e-imza içeriyor. Beta sürüm imzasız belgeleri dönüştürür.");
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
      if (!["content", "space", "tab"].includes(run.tagName) || run.children.length) fail();
      const fields = attributes(run, ["resolver", "description", "startOffset", "length", ...formatFields]);
      const start = number(fields.startOffset, NaN, 0, text.length);
      const length = number(fields.length, NaN, 0, text.length);
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < textCursor || start + length > text.length) fail();
      if (runs.length && start !== textCursor) fail();
      if (!ignorable(text.slice(textCursor, start))) fail();
      textCursor = start + length;
      const value = text.slice(start, textCursor);
      if (run.tagName === "tab" && value !== "\t") fail();
      runs.push({ text: value, style: { ...settings, ...resolve(fields.resolver), ...fields } });
    }
    if (isBreak) {
      if (runs.some(run => !ignorable(run.text))) fail();
      if (paragraph) blocks.push({ break: true });
      continue;
    }
    const paragraphText = runs.map(run => run.text).join("").replace(/[\r\n]+$/u, "");
    if (/[\u0000-\u0008\u000a-\u001f\u00a0\u202a-\u202e\u2066-\u2069]/u.test(paragraphText)) fail();
    blocks.push({ settings, runs });
  }
  if (!ignorable(text.slice(textCursor)) || ignorable(text) || !blocks.length) fail();
  return { dimensions, margins, blocks };
}

function loadDocument(file) {
  if (!parsedDocuments.has(file)) parsedDocuments.set(file, readUdf(file).then(parseDocument));
  return parsedDocuments.get(file);
}

function styleFamily(style) {
  const name = style.family?.trim() || defaultFontFamily;
  return udfFontFamilyKey(name) === "serif" ? defaultFontFamily : name;
}

function styleFace(style) {
  if (style.background != null && !["-1", "16777215", "0"].includes(style.background)) fail();
  for (const key of ["bold", "italic", "underline"]) {
    if (style[key] != null && !["true", "false"].includes(style[key])) fail();
  }
  const bold = style.bold === "true";
  const italic = style.italic === "true";
  if (bold && italic) return "boldItalic";
  return bold ? "bold" : italic ? "italic" : "regular";
}

function visibleText(value) {
  return value.replace(/[\r\n\u200b]/gu, "");
}

export async function inspectUdfFonts(file) {
  const { blocks } = await loadDocument(file);
  return collectFontRequirements(blocks);
}

function collectFontRequirements(blocks) {
  const needed = new Map();
  for (const block of blocks) {
    if (block.break) continue;
    const styles = block.runs.filter(run => run.text).map(run => run.style);
    for (const style of styles.length ? styles : [block.settings]) {
      const family = styleFamily(style);
      const key = udfFontFamilyKey(family);
      const requirement = needed.get(key) ?? { family, faces: new Set() };
      requirement.faces.add(styleFace(style));
      needed.set(key, requirement);
    }
  }
  return [...needed.values()].map(({ family, faces }) => ({ family, faces: [...faces] }));
}

function styleColor(value) {
  const color = number(value, -16777216, -2147483648, 4294967295) >>> 0;
  return rgb(((color >>> 16) & 255) / 255, ((color >>> 8) & 255) / 255, (color & 255) / 255);
}

function lineMetrics(metrics, size, spacing) {
  const scale = size / metrics.unitsPerEm;
  // Reference exports round the scaled hhea height up and pad both line edges.
  const height = Math.ceil((metrics.ascent - metrics.descent + metrics.lineGap) * scale);
  const padding = Math.floor(height * spacing / 2);
  return {
    ascent: Math.ceil(metrics.ascent * scale) + padding,
    height: height + 2 * padding,
  };
}

async function paragraphTokens(runs, baseSize, spacing, getFont) {
  const tokens = [];
  for (const run of runs) {
    const text = visibleText(run.text);
    if (!text) continue;
    const { font, metrics, characters } = await getFont(run.style);
    if ([...text].some(character => character !== "\t" && !characters.has(character.codePointAt(0)))) {
      fail(`“${styleFamily(run.style)}” yazı tipinde belgedeki bazı karakterler bulunamadı.`);
    }
    const size = number(run.style.size, baseSize, 1, 96);
    const style = {
      ...lineMetrics(metrics, size, spacing),
      size,
      color: styleColor(run.style.foreground),
      font,
      underline: run.style.underline === "true",
    };
    for (const piece of text.match(/\t| +|[^ \t]+/gu) ?? []) {
      const type = piece === "\t" ? "tab" : piece.startsWith(" ") ? "space" : "word";
      const advance = type === "tab" ? 0 : font.widthOfTextAtSize(piece, size);
      const previous = tokens.at(-1);
      const item = { piece, ...style, advance };
      if (type === "word" && previous?.type === "word") {
        previous.items.push(item);
        previous.advance += advance;
      } else tokens.push({ type, items: [item], advance });
    }
  }
  return tokens;
}

async function layoutParagraph(block, width, getFont) {
  const { settings, runs } = block;
  const align = number(settings.Alignment, 0, 0, 2);
  if (!Number.isInteger(align)) fail();
  const left = Math.trunc(number(settings.LeftIndent, 0, 0, width - 24));
  const right = Math.trunc(number(settings.RightIndent, 0, 0, width - left - 24));
  const firstIndent = Math.trunc(number(settings.FirstLineIndent, 0, -left, width - right - left - 24));
  const spacing = number(settings.LineSpacing, 0, 0, 3);
  const above = Math.trunc(number(settings.SpaceAbove, 0, 0, 250));
  const below = Math.trunc(number(settings.SpaceBelow, 0, 0, 250));
  const baseSize = number(settings.size, 12, 1, 96);
  const tokens = await paragraphTokens(runs, baseSize, spacing, getFont);
  const lines = [];
  let line;
  function startLine() {
    const indent = left + (lines.length ? 0 : firstIndent);
    line = { items: [], used: 0, height: 0, indent, available: width - indent - right };
    lines.push(line);
  }
  function add(item, advance = item.advance) {
    line.items.push({ ...item, advance, x: line.used });
    line.used += advance;
    line.height = Math.max(line.height, item.height);
  }
  startLine();
  for (const token of tokens) {
    if (token.type === "tab") {
      if (align !== 0 || token.items[0].underline) fail();
      const position = line.indent - left + line.used;
      const advance = (Math.floor(position / 72) + 1) * 72 - position;
      if (line.used + advance > line.available) fail();
      add(token.items[0], advance);
      continue;
    }
    if (token.type === "word" && line.used + token.advance > line.available && line.items.some(item => item.piece.trim())) startLine();
    if (token.type === "space" && !line.items.length && lines.length > 1) continue;
    if (token.type === "word" && line.used + token.advance > line.available) fail();
    for (const item of token.items) add(item);
  }
  const ending = runs.findLast(run => /[\r\n]/u.test(run.text));
  if (ending) {
    const { metrics } = await getFont(ending.style);
    const size = number(ending.style.size, baseSize, 1, 96);
    line.height = Math.max(line.height, lineMetrics(metrics, size, spacing).height);
  }
  for (const line of lines) {
    while (line.items.length && !line.items.at(-1).piece.trim()) line.used -= line.items.pop().advance;
    if (!line.height) line.height = lineMetrics((await getFont(settings)).metrics, baseSize, spacing).height;
    line.x = line.indent + Math.floor((line.available - Math.floor(line.used)) * (align === 1 ? 0.5 : align === 2 ? 1 : 0));
  }
  return { above, below, lines };
}

export async function udfToPdf(file, customFonts = new Map()) {
  const { dimensions: [width, height], margins: [left, right, top, bottom], blocks } = await loadDocument(file);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const embedded = new Map();
  const alternativeFonts = new Set();
  async function getFont(style) {
    const family = styleFamily(style);
    const key = udfFontFamilyKey(family);
    const face = styleFace(style);
    const supplied = customFonts.get(key)?.faces[face];
    if (!supplied) {
      if (customFonts.size || ![udfFontFamilyKey(defaultFontFamily), udfFontFamilyKey(fallbackFontFamily)].includes(key)) {
        fail(`Belge için “${family}” yazı tipinin ${faceLabels[face]} TTF dosyasını ekleyin.`);
      }
      if (key !== udfFontFamilyKey(fallbackFontFamily)) alternativeFonts.add(family);
    }
    const fontKey = `${supplied ? key : udfFontFamilyKey(fallbackFontFamily)}:${face}`;
    if (!embedded.has(fontKey)) {
      let bytes = supplied?.bytes;
      if (!bytes) {
        const response = await fetch(fontUrls[face]);
        if (!response.ok) fail("UDF yazı tipi yüklenemedi. Yeniden deneyin.");
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const metrics = fontkit.create(bytes);
      const font = await document.embedFont(bytes, {
        subset: supplied?.subset ?? true,
        features: { kern: false, liga: false, clig: false, calt: false },
      });
      embedded.set(fontKey, { font, metrics, characters: new Set(font.getCharacterSet()) });
    }
    return embedded.get(fontKey);
  }
  for (const { family, faces } of collectFontRequirements(blocks)) {
    if (!customFonts.size) continue;
    const supplied = customFonts.get(udfFontFamilyKey(family));
    const missing = faces.filter(face => !supplied?.faces[face]);
    if (missing.length) fail(`“${family}” için şu TTF biçimlerini ekleyin: ${missing.map(face => faceLabels[face]).join(", ")}.`);
  }

  // Reference exports adjust the PDF page box for unequal opposing margins.
  // Wrapping still uses the width of the source page between the margins.
  const pageSize = [width + left - right, height + top - bottom].map(value => Math.round(value * 100) / 100);
  const textOrigin = Math.floor(left) + 1;
  const contentWidth = Math.floor(width - right) - textOrigin;

  let page;
  let y;
  const fontKeys = new Map();
  const topOfPage = pageSize[1] - Math.floor(top);
  function newPage() {
    if (document.getPageCount() >= 100) fail("Bu UDF beta sürümünün 100 sayfa sınırını aşıyor.");
    page = document.addPage(pageSize);
    y = topOfPage;
    fontKeys.clear();
  }
  newPage();
  for (const block of blocks) {
    if (block.break) {
      newPage();
      continue;
    }
    const paragraph = await layoutParagraph(block, contentWidth, getFont);
    y -= paragraph.above;
    for (const [index, line] of paragraph.lines.entries()) {
      if (y - line.height < bottom) {
        newPage();
        if (index === 0) y -= paragraph.above;
        if (y - line.height < bottom) fail();
      }
      const text = [pushGraphicsState(), beginText()];
      const underlines = [];
      for (const item of line.items) {
        if (item.piece === "\t") continue;
        // Round cumulative advances at the draw boundary to avoid per-glyph drift.
        const x = textOrigin + line.x + Math.round(item.x);
        const baseline = y - line.height + item.height - item.ascent;
        if (!fontKeys.has(item.font)) fontKeys.set(item.font, page.node.newFontDictionary("UdfFont", item.font.ref));
        text.push(setFillingColor(item.color), setFontAndSize(fontKeys.get(item.font), item.size),
          setTextMatrix(1, 0, 0, 1, x, baseline), showText(item.font.encodeText(item.piece)));
        if (item.underline) {
          const underlineY = baseline - 3;
          underlines.push({
            start: { x, y: underlineY }, end: { x: x + Math.floor(item.advance), y: underlineY },
            thickness: 1, color: item.color,
          });
        }
      }
      page.pushOperators(...text, endText(), popGraphicsState());
      for (const underline of underlines) page.drawLine(underline);
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
    warnings: alternativeFonts.size
      ? [`${[...alternativeFonts].join(", ")} dosyası eklenmediği için Liberation Serif kullanıldı. Yerleşim farklılıkları için önizlemeyi kontrol edin.`]
      : [],
  };
}
