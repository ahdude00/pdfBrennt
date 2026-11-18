// Reads a UDF package into a document model. Everything that the converter cannot
// reproduce exactly is rejected with a message that names the feature.
import { unzipSync } from "fflate";
import { parseXml } from "./xml.js";

export const maxFileBytes = 16 * 1024 * 1024;
const maxTextCharacters = 400000;
const maxArchiveEntries = 16;
export const unsupported = "Bu UDF, dönüştürücünün birebir çizebildiği düzenin dışında.";

export class UdfError extends Error {}

export function fail(message = unsupported) {
  throw new UdfError(message);
}

export const formatFields = ["family", "size", "bold", "italic", "underline", "foreground", "background", "strikethrough", "subscript", "superscript"];
const paragraphFields = ["Alignment", "LeftIndent", "RightIndent", "FirstLineIndent", "SpaceAbove", "SpaceBelow", "LineSpacing", "TabSet",
  "Bulleted", "BulletType", "Numbered", "NumberType", "ListId", "ListLevel", "Hanging"];
// Paragraph and list attributes that UYAP Editör sometimes leaves on character
// elements. They have no effect there.
const strayRunFields = [...paragraphFields, "SecListTypeLevel1", "SecListTypeLevel2", "SecListTypeLevel3", "SecListTypeLevel4",
  "SecListTypeLevel5", "SecListTypeLevel6", "NumberSetted", "RepeatingLabel", "TabByPass"];
const segmentTags = ["content", "space", "tab", "image"];

function attributes(element, allowed, feature) {
  for (const name of Object.keys(element.attributes)) {
    if (!allowed.includes(name)) fail(feature ? `Bu UDF ${feature} içeriyor. Bu öğe henüz birebir dönüştürülemiyor.` : unsupported);
  }
  return element.attributes;
}

export function number(value, fallback, min = 0, max = 100000) {
  if (value == null) return fallback;
  const result = String(value).trim() ? Number(value) : NaN;
  if (!Number.isFinite(result) || result < min || result > max) fail();
  return result;
}

function children(element, name) {
  return element.children.filter(child => child.name === name);
}

function single(element, name, required = true) {
  const matches = children(element, name);
  if (matches.length > 1 || (required && !matches.length)) fail();
  return matches[0];
}

function readPackage(bytes) {
  if (!bytes.length || bytes.length > maxFileBytes) fail("16 MB veya daha küçük, geçerli bir UDF seçin.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) fail("UDF paketi okunamadı.");
  const entries = [];
  let archive;
  try {
    archive = unzipSync(bytes, { filter: entry => {
      if (entries.length >= maxArchiveEntries) fail();
      entries.push(entry);
      return entry.name === "content.xml" && entry.originalSize <= maxFileBytes * 2;
    } });
  } catch (error) {
    if (error instanceof UdfError) throw error;
    fail("UDF paketi okunamadı.");
  }
  const signed = entries.some(entry => /(?:^|\/)sign\.sgn$/iu.test(entry.name));
  const other = entries.filter(entry => entry.name !== "content.xml" && !entry.name.endsWith("/") && !/(?:^|\/)sign\.sgn$/iu.test(entry.name));
  if (other.length) fail();
  if (entries.filter(entry => entry.name === "content.xml").length !== 1 || !archive["content.xml"]) fail("UDF paketi okunamadı.");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(archive["content.xml"]);
  } catch {
    fail("UDF belgesinin metni okunamadı.");
  }
  return { source, signed };
}

function decodeBase64(value) {
  const clean = value.replace(/\s+/gu, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(clean) || clean.length % 4 === 1) fail("UDF içindeki bir görsel okunamadı.");
  if (typeof atob === "function") {
    const binary = atob(clean);
    const result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
    return result;
  }
  return new Uint8Array(Buffer.from(clean, "base64"));
}

function imageFormat(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  return fail("UDF içindeki bir görsel PNG veya JPEG değil. Bu görsel biçimi henüz desteklenmiyor.");
}

export function parseUdf(bytes) {
  const { source, signed } = readPackage(bytes);
  const root = parseXml(source, fail);
  if (root.name !== "template" || attributes(root, ["format_id"]).format_id !== "1.8") fail();
  const sections = ["content", "properties", "styles", "elements"];
  if (root.children.some(child => !sections.includes(child.name))) fail();
  const textElement = single(root, "content");
  if (textElement.children.length) fail();
  const text = textElement.text;
  if (text.length > maxTextCharacters) fail("Bu UDF dönüştürücünün metin sınırını aşıyor.");

  const properties = single(root, "properties");
  const pageFormat = single(properties, "pageFormat");
  if (properties.children.length !== 1 || pageFormat.children.length) {
    fail(children(properties, "bgImage").length ? "Bu UDF sayfa arka plan görseli içeriyor. Bu öğe henüz birebir dönüştürülemiyor." : unsupported);
  }
  const format = attributes(pageFormat, [
    "mediaSizeName", "paperOrientation", "leftMargin", "rightMargin", "topMargin", "bottomMargin", "headerFOffset", "footerFOffset",
  ]);
  if ((format.mediaSizeName ?? "1") !== "1") fail("Bu UDF A4 dışında bir kâğıt boyutu kullanıyor. Bu boyut henüz birebir dönüştürülemiyor.");
  if ((format.paperOrientation ?? "1") !== "1") fail("Bu UDF yatay sayfa kullanıyor. Yatay sayfa henüz birebir dönüştürülemiyor.");
  const margins = {
    left: number(format.leftMargin, 42.52, 0, 400), right: number(format.rightMargin, 28.35, 0, 400),
    top: number(format.topMargin, 14.17, 0, 400), bottom: number(format.bottomMargin, 14.17, 0, 400),
    header: number(format.headerFOffset, 20, 0, 400), footer: number(format.footerFOffset, 20, 0, 400),
  };

  const styles = new Map();
  const styleSection = single(root, "styles", false);
  for (const style of styleSection?.children ?? []) {
    if (style.name !== "style" || style.children.length) fail();
    const fields = attributes(style, ["name", "description", "FONT_ATTRIBUTE_KEY", "resolver", ...formatFields, ...paragraphFields]);
    if (!fields.name || styles.has(fields.name)) fail();
    styles.set(fields.name, fields);
  }
  const resolving = new Set();
  function resolve(name) {
    if (!name) return {};
    const style = styles.get(name);
    if (!style) fail();
    if (resolving.has(name)) fail();
    resolving.add(name);
    const { resolver, name: ignoredName, description, FONT_ATTRIBUTE_KEY, ...fields } = style;
    const result = { ...(resolver && resolver !== name ? resolve(resolver) : {}), ...fields };
    resolving.delete(name);
    return result;
  }

  const elements = single(root, "elements");
  const { resolver } = attributes(elements, ["resolver"]);
  const defaults = { ...resolve(styles.has("hvl-default") ? "hvl-default" : null), ...resolve(resolver) };
  const covered = new Uint8Array(text.length);
  let segmentCount = 0;

  function cover(start, length) {
    for (let index = start; index < start + length; index++) {
      if (covered[index]) fail();
      covered[index] = 1;
    }
  }

  function readParagraph(element) {
    const fields = attributes(element, ["resolver", "description", ...formatFields, ...paragraphFields]);
    const list = readList(fields);
    const settings = { ...defaults, ...resolve(fields.resolver), ...fields };
    const runs = [];
    for (const segment of element.children) {
      if (!segmentTags.includes(segment.name)) fail(segment.name === "field" ? "Bu UDF alan (field) içeriyor. Bu öğe henüz birebir dönüştürülemiyor." : unsupported);
      if (segment.children.length) fail();
      const isImage = segment.name === "image";
      // Character elements may carry paragraph attributes and, on content, a stale image size. Swing ignores both.
      const values = attributes(segment, ["resolver", "description", "startOffset", "length", ...formatFields, ...strayRunFields, ...(isImage ? ["imageData"] : []), "width", "height"]);
      if (!isImage) { delete values.width; delete values.height; }
      for (const field of strayRunFields) delete values[field];
      const start = number(values.startOffset, NaN, 0, text.length);
      const length = number(values.length, NaN, 0, text.length);
      if (!Number.isInteger(start) || !Number.isInteger(length) || start + length > text.length) fail();
      if (++segmentCount > 200000) fail();
      cover(start, length);
      const value = text.slice(start, start + length);
      const { imageData, width, height, startOffset, length: ignoredLength, resolver: runResolver, description, ...format } = values;
      const style = { ...settings, ...resolve(runResolver), ...format };
      if (isImage) {
        if (length !== 1 || !imageData) fail();
        const bytes = decodeBase64(imageData);
        runs.push({ type: "image", text: value, style, image: {
          bytes, format: imageFormat(bytes), width: number(width, NaN, 0.01, 20000), height: number(height, NaN, 0.01, 20000),
        } });
        continue;
      }
      if (segment.name === "tab" && value !== "\t") fail();
      runs.push({ type: "text", text: value, style });
    }
    const paragraphText = runs.filter(run => run.type === "text").map(run => run.text).join("").replace(/[\r\n]+$/u, "");
    if (/[\u0000-\u0008\u000a-\u001f‪-‮⁦-⁩]/u.test(paragraphText)) fail();
    return { type: "paragraph", settings, runs, list };
  }

  // Numbered paragraphs count per ListId in reading order.
  const listCounters = new Map();
  function readList(fields) {
    const numbered = fields.Numbered === "true";
    const bulleted = fields.Bulleted === "true";
    if (!numbered && !bulleted) return null;
    if (numbered && bulleted) fail();
    if ((fields.ListLevel ?? "0") !== "0") fail("Bu UDF çok düzeyli liste içeriyor. Alt düzeyler henüz birebir dönüştürülemiyor.");
    if (fields.Hanging != null && Number(fields.Hanging) !== 0) fail("Bu UDF asılı girintili liste içeriyor. Bu liste henüz birebir dönüştürülemiyor.");
    if (bulleted) {
      if ((fields.BulletType ?? "BULLET_TYPE_ELLIPSE") !== "BULLET_TYPE_ELLIPSE") fail("Bu UDF yuvarlak dışında bir madde işareti içeriyor. Bu işaret henüz birebir dönüştürülemiyor.");
      return { kind: "bullet" };
    }
    const id = fields.ListId ?? "";
    const value = (listCounters.get(id) ?? 0) + 1;
    listCounters.set(id, value);
    return { kind: "number", type: fields.NumberType ?? "NUMBER_TYPE_NUMBER_DOT", value };
  }

  const sectionBlocks = { header: null, footer: null };
  function readSection(element) {
    if (sectionBlocks[element.name]) fail();
    const values = attributes(element, ["background", "foreground", "startPage", "stopPage", "pageNumber-spec", "pageNumber-afterStr",
      "pageNumber-color", "pageNumber-fontBold", "pageNumber-fontFace", "pageNumber-fontItalic", "pageNumber-fontSize", "pageNumber-fontUnderline",
      "pageNumber-foreStr", "pageNumber-pageStartNumStr", "pageNumber-seperator"]);
    if (values["pageNumber-spec"] != null && values["pageNumber-spec"] !== "0") {
      fail("Bu UDF sayfa numarası içeriyor. Sayfa numarası henüz birebir dönüştürülemiyor.");
    }
    if (!["1", undefined].includes(values.startPage) || values.stopPage != null) {
      fail("Bu UDF yalnızca bazı sayfalarda görünen üstbilgi veya altbilgi içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
    }
    if (values.background != null && !["-1", "16777215"].includes(values.background)) fail("Bu UDF renkli üstbilgi veya altbilgi içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
    sectionBlocks[element.name] = readBlocks(element, ["paragraph", "table"]);
  }

  function readBlocks(container, allowed) {
    const blocks = [];
    for (const element of container.children) {
      if ((element.name === "header" || element.name === "footer") && container === elements) {
        readSection(element);
        continue;
      }
      if (!allowed.includes(element.name)) fail();
      if (element.name === "paragraph") blocks.push(readParagraph(element));
      else if (element.name === "page-break") {
        attributes(element, []);
        if (element.children.length > 1) fail();
        const paragraph = element.children[0];
        if (paragraph) {
          if (paragraph.name !== "paragraph") fail();
          const { runs } = readParagraph(paragraph);
          if (runs.some(run => run.type !== "text" || run.text.trim())) fail();
        }
        blocks.push({ type: "pageBreak" });
      } else if (element.name === "table") blocks.push(readTable(element));
    }
    return blocks;
  }

  function readTable(element) {
    const values = attributes(element, ["tableName", "columnCount", "columnSpans", "border"], "gelişmiş tablo biçimleri");
    const columnCount = number(values.columnCount, NaN, 1, 64);
    if (!Number.isInteger(columnCount)) fail();
    const spans = (values.columnSpans ?? "").split(",").map(value => number(value, NaN, 0.01, 100000));
    if (spans.length !== columnCount) fail();
    const border = values.border ?? "borderCell";
    if (!["borderCell", "borderNone"].includes(border)) fail("Bu UDF farklı tablo kenarlıkları içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
    const rows = [];
    for (const rowElement of element.children) {
      if (rowElement.name !== "row") fail();
      const rowValues = attributes(rowElement, ["rowName", "rowType"], "gelişmiş tablo satırları");
      if (rowValues.rowType != null && rowValues.rowType !== "dataRow") fail("Bu UDF başlık satırı tekrarlayan tablo içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
      const cells = rowElement.children.map(cellElement => {
        if (cellElement.name !== "cell") fail();
        attributes(cellElement, [], "birleştirilmiş veya biçimlendirilmiş tablo hücreleri");
        const blocks = readBlocks(cellElement, ["paragraph"]);
        if (!blocks.length) fail();
        return { blocks };
      });
      if (cells.length !== columnCount) fail("Bu UDF birleştirilmiş tablo hücreleri içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
      rows.push({ cells });
    }
    if (!rows.length) fail();
    return { type: "table", spans, border, rows };
  }

  const blocks = readBlocks(elements, ["paragraph", "page-break", "table"]);
  for (let index = 0; index < text.length; index++) {
    if (!covered[index] && !/[\s​]/u.test(text[index])) fail();
  }
  if (!blocks.length || !segmentCount) fail();
  return { margins, blocks, header: sectionBlocks.header ?? [], footer: sectionBlocks.footer ?? [], signed };
}
