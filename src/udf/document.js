// Reads a UDF package into a document model. Everything that the converter cannot
// reproduce exactly is rejected with a message that names the feature.
import { unzipSync } from "fflate";
import { parseXml } from "./xml.js";
import { listNumber, outlineLabel } from "./lists.js";

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
  "Bulleted", "BulletType", "Numbered", "NumberType", "ListId", "ListLevel", "Hanging", "NumberSetted",
  "SecListTypeLevel1", "SecListTypeLevel2", "SecListTypeLevel3", "SecListTypeLevel4", "SecListTypeLevel5", "SecListTypeLevel6"];
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

// Long.parseLong, kept exact as a BigInt.
function javaLong(value) {
  if (!/^[+-]?\d+$/u.test(value.trim())) fail();
  const result = BigInt(value.trim());
  if (result < -(2n ** 63n) || result >= 2n ** 63n) fail();
  return result;
}

// Integer.parseInt: an optional sign and decimal digits within the int range.
export function javaInt(value, fallback) {
  if (value == null) return fallback;
  if (!/^[+-]?\d+$/u.test(value)) fail();
  const result = Number(value);
  if (result < -2147483648 || result > 2147483647) fail();
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
    "paperWidth", "paperHeight",
  ]);
  // UYAP sizes the paper by mediaSizeName alone (paperWidth and paperHeight are not
  // read); orientation 0 or 2 is landscape.
  const paper = { media: javaInt(format.mediaSizeName, 1), landscape: ["0", "2"].includes(format.paperOrientation?.trim()) };
  if (format.paperOrientation != null && !["0", "1", "2"].includes(format.paperOrientation.trim())) fail();
  // Verified against UYAP: Monarch, A4, A5, Letter and JIS B5 (codes 0–4; 10 and above
  // fall back to A4). Legal paginates one row differently and 6–9 are not verified yet.
  if (paper.media >= 5 && paper.media <= 9) fail("Bu UDF henüz doğrulanmamış bir kâğıt boyutu kullanıyor. Bu boyut henüz birebir dönüştürülemiyor.");
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

  // List settings as UYAP's paragraph view reads them. Every paragraph with a ListId
  // joins that list, list paragraph or not; markers are numbered afterwards.
  const listMembers = new Map();
  function readList(fields) {
    const flag = value => value != null && value.trim().toLowerCase() === "true";
    const bulletedAttribute = flag(fields.Bulleted);
    const numberedAttribute = flag(fields.Numbered);
    let level = javaInt(fields.ListLevel, 0);
    if (level === 0) level = 1;
    const sec = level >= 1 && level <= 6 ? fields[`SecListTypeLevel${level}`] ?? null : null;
    // With both flags set, the level's own style decides, and without one the
    // paragraph is numbered.
    const both = bulletedAttribute && numberedAttribute;
    const bulleted = both ? sec != null && sec.startsWith("BULLET_TYPE") : bulletedAttribute;
    const numbered = both ? sec == null || sec.startsWith("NUMBER_TYPE") : numberedAttribute;
    const id = fields.ListId == null ? "0" : String(javaLong(fields.ListId));
    const list = {
      bulleted, numbered, sec, id, value: 0, outline: "",
      level: bulleted || numbered ? level : 0,
      bulletType: fields.BulletType ?? null,
      numberType: fields.NumberType ?? null,
      start: numbered ? javaInt(fields.NumberSetted, -1) : -1,
    };
    if (id !== "0") listMembers.set(id, [...(listMembers.get(id) ?? []), list]);
    return list;
  }

  const sectionBlocks = { header: null, footer: null };
  const pageNumbers = { header: null, footer: null };
  function readSection(element) {
    if (sectionBlocks[element.name]) fail();
    const values = attributes(element, ["background", "foreground", "startPage", "stopPage", "pageNumber-spec", "pageNumber-afterStr",
      "pageNumber-color", "pageNumber-fontBold", "pageNumber-fontFace", "pageNumber-fontItalic", "pageNumber-fontSize", "pageNumber-fontUnderline",
      "pageNumber-foreStr", "pageNumber-pageStartNumStr", "pageNumber-seperator"]);
    pageNumbers[element.name] = readPageNumber(values);
    if (!["1", undefined].includes(values.startPage) || values.stopPage != null) {
      fail("Bu UDF yalnızca bazı sayfalarda görünen üstbilgi veya altbilgi içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
    }
    if (values.background != null && !["-1", "16777215"].includes(values.background)) fail("Bu UDF renkli üstbilgi veya altbilgi içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
    sectionBlocks[element.name] = readBlocks(element, ["paragraph", "table"]);
  }

  // The page number of a header or footer, read as UYAP Editör's section view does.
  // pageNumber-spec is a bit set: 8 bottom (else top), 32 centre, 64 right (else
  // left), 2048 append the page count, 4096 not on page 1, 8192 not on a single page.
  function readPageNumber(values) {
    const spec = javaInt(values["pageNumber-spec"]?.replace(/^BSP32_/u, ""), 0);
    if (!spec) return null;
    const flag = value => value != null && value.trim().toLowerCase() === "true";
    // An unreadable start number falls back to 1, like Integer.parseInt in UYAP.
    let start = 1;
    try {
      start = javaInt(values["pageNumber-pageStartNumStr"], 1);
    } catch {
      start = 1;
    }
    // Without a face Java uses its Dialog font, whose Latin glyphs are Arial on Windows.
    // Only glyph shapes matter here: the number is placed by its own bounds.
    const face = values["pageNumber-fontFace"]?.trim();
    return {
      spec, start,
      style: { family: !face || face.toLowerCase() === "dialog" ? "Arial" : face, bold: String(flag(values["pageNumber-fontBold"])), italic: String(flag(values["pageNumber-fontItalic"])) },
      size: javaInt(values["pageNumber-fontSize"], 11),
      color: javaInt(values["pageNumber-color"], -16777216),
      fore: values["pageNumber-foreStr"] ?? "", after: values["pageNumber-afterStr"] ?? "", separator: values["pageNumber-seperator"] ?? " ",
    };
  }

  function readBlocks(container, allowed) {
    const blocks = [];
    for (const element of container.children) {
      if ((element.name === "header" || element.name === "footer") && container === elements) {
        // UYAP Editör writes the header before the body and the footer after it. In any
        // other order UYAP itself shifts the body, so such documents are refused.
        if ((element.name === "header" && blocks.length) || sectionBlocks.footer) {
          fail("Bu UDF’de üstbilgi veya altbilgi alışılmadık bir sırada. Bu düzen henüz birebir dönüştürülemiyor.");
        }
        readSection(element);
        continue;
      }
      if (container === elements && sectionBlocks.footer) fail("Bu UDF’de üstbilgi veya altbilgi alışılmadık bir sırada. Bu düzen henüz birebir dönüştürülemiyor.");
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

  // Border settings of a table, row or cell: borderSpec bits (1 = draw only the sides
  // in 2 top, 4 right, 8 bottom, 16 left, else a rectangle), borderStyle, borderWidth
  // and borderColor. They are only drawn by the table's border kind.
  const borderFields = ["borderSpec", "borderStyle", "borderWidth", "borderColor"];
  function readBorder(values) {
    return {
      spec: javaInt(values.borderSpec, 0),
      style: values.borderStyle ?? null,
      width: number(values.borderWidth, 0, -1000, 1000),
      color: values.borderColor == null ? null : javaInt(values.borderColor, 0),
    };
  }

  function readSpans(value, count) {
    const spans = (value ?? "").split(",").map(part => number(part, NaN, 0.01, 100000));
    if (count != null && spans.length !== count) fail();
    return spans;
  }

  function readTable(element) {
    const values = attributes(element, ["tableName", "columnCount", "columnSpans", "border", ...borderFields], "gelişmiş tablo biçimleri");
    const columnCount = number(values.columnCount, NaN, 1, 64);
    if (!Number.isInteger(columnCount)) fail();
    const spans = readSpans(values.columnSpans, columnCount);
    const border = values.border ?? "borderCell";
    if (!["borderCell", "borderNone", "borderRow", "borderTable"].includes(border)) fail("Bu UDF farklı tablo kenarlıkları içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
    const rows = [];
    for (const rowElement of element.children) {
      if (rowElement.name !== "row") fail();
      // UYAP Editör ignores a row height and does not repeat header rows on new pages.
      // A row whose cells were resized on their own carries its own columnSpans.
      const rowValues = attributes(rowElement, ["rowName", "rowType", "height", "columnSpans", ...borderFields], "gelişmiş tablo satırları");
      if (rowValues.rowType != null && !["dataRow", "headerRow"].includes(rowValues.rowType)) fail();
      const cells = rowElement.children.map(cellElement => {
        if (cellElement.name !== "cell") fail();
        const cellValues = attributes(cellElement, borderFields, "biçimlendirilmiş tablo hücreleri");
        const blocks = readBlocks(cellElement, ["paragraph"]);
        if (!blocks.length) fail();
        return { blocks, border: readBorder(cellValues) };
      });
      if (!cells.length) fail();
      rows.push({ cells, spans: rowValues.columnSpans?.trim() ? readSpans(rowValues.columnSpans) : null, border: readBorder(rowValues) });
    }
    if (!rows.length) fail();
    return { type: "table", spans, border, borderStyle: readBorder(values), rows };
  }

  const blocks = readBlocks(elements, ["paragraph", "page-break", "table"]);
  // Number the list paragraphs now that every list is known. Without a ListId UYAP
  // finds no list and counts 0.
  for (const members of listMembers.values()) {
    members.forEach((member, index) => {
      member.value = listNumber(members, index);
      member.outline = outlineLabel(members, index);
    });
  }
  for (let index = 0; index < text.length; index++) {
    if (!covered[index] && !/[\s​]/u.test(text[index])) fail();
  }
  if (!blocks.length || !segmentCount) fail();
  return { margins, paper, blocks, header: sectionBlocks.header ?? [], footer: sectionBlocks.footer ?? [], pageNumbers, signed };
}
