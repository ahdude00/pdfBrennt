// UDF → PDF conversion core. It has no browser dependencies: the caller supplies
// the bytes of the bundled fallback fonts through `loadFallbackFont`.
import {
  LineCapStyle, PDFDocument, beginText, endText, lineTo, moveTo, popGraphicsState, pushGraphicsState, rectangle, rgb,
  closePath, fill, setDashPattern, setFillingColor, setFillingRgbColor, setFontAndSize, setLineCap, setLineJoin, setLineWidth, setStrokingRgbColor, setTextMatrix, showText, stroke,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { udfFontFamilyKey } from "../udf-custom-fonts.js";
import { defaultUdfFontFamily, udfFontPresets } from "../udf-font-presets.js";
import { fail, parseUdf } from "./document.js";
import { layoutDocument } from "./layout.js";
import { hasJavaMetrics, measureFont } from "./metrics.js";

const faceLabels = { regular: "normal", bold: "kalın", italic: "italik", boldItalic: "kalın italik" };
const fallbackFamilies = new Map(udfFontPresets.flatMap(({ family, fallback }) => [
  [udfFontFamilyKey(family), fallback],
  [udfFontFamilyKey(fallback), fallback],
]));
// Java logical font names and the physical fonts they stand for on Windows.
const logicalFamilies = new Map([["serif", "Times New Roman"], ["sansserif", "Arial"], ["sans-serif", "Arial"]]);
const javaFamilyOf = new Map([["liberation serif", "times new roman"], ["liberation sans", "arial"]]);
const parsed = new WeakMap();

function load(bytes) {
  if (!parsed.has(bytes)) parsed.set(bytes, parseUdf(bytes));
  return parsed.get(bytes);
}

function styleFamily(style, defaultFamily) {
  const name = style.family?.trim() || defaultFamily;
  return logicalFamilies.get(udfFontFamilyKey(name)) ?? name;
}

// Java's Font.getItalicAngle is the hhea caret slope run over rise. The Microsoft
// fonts UYAP measures with have 7/33 (Arial) and 7/24 (Times New Roman) in their
// italic faces; the Liberation substitutes round these to 0.21 and 0.29.
const javaItalicAngles = new Map([["arial", 7 / 33], ["times new roman", 7 / 24]]);

function italicAngle(entry) {
  if (!entry.faceName.toLowerCase().includes("italic")) return 0;
  if (javaItalicAngles.has(entry.javaFamily)) return javaItalicAngles.get(entry.javaFamily);
  const { caretSlopeRise, caretSlopeRun } = entry.metrics.hhea;
  return caretSlopeRise ? caretSlopeRun / caretSlopeRise : 0;
}

function styleFace(style) {
  for (const key of ["bold", "italic"]) {
    if (style[key] != null && !["true", "false"].includes(style[key])) fail();
  }
  const bold = style.bold === "true";
  const italic = style.italic === "true";
  return bold ? (italic ? "boldItalic" : "bold") : (italic ? "italic" : "regular");
}

function* paragraphs(blocks) {
  for (const block of blocks) {
    if (block.type === "paragraph") yield block;
    else if (block.type === "table") for (const row of block.rows) for (const cell of row.cells) yield* paragraphs(cell.blocks);
  }
}

function collectFontRequirements(blocks, defaultFamily) {
  const needed = new Map();
  for (const block of paragraphs(blocks)) {
    const styles = block.runs.filter(run => run.type === "text").map(run => run.style);
    for (const style of [...styles, block.settings]) {
      const family = styleFamily(style, defaultFamily);
      const key = udfFontFamilyKey(family);
      const requirement = needed.get(key) ?? { family, faces: new Set() };
      requirement.faces.add(styleFace(style));
      needed.set(key, requirement);
    }
  }
  return [...needed.values()].map(({ family, faces }) => ({ family, faces: [...faces] }));
}

function allBlocks(model) {
  return [...model.header, ...model.blocks, ...model.footer];
}

// Page numbers are drawn with a style of their own; they join the font list as a paragraph would.
function pageNumberBlocks(model) {
  return Object.values(model.pageNumbers).filter(Boolean).map(({ style }) => ({ type: "paragraph", runs: [], settings: style }));
}

function documentFontRequirements(model, defaultFamily) {
  return collectFontRequirements([...allBlocks(model), ...pageNumberBlocks(model)], defaultFamily);
}

export function inspectUdf(bytes, defaultFamily = defaultUdfFontFamily) {
  return documentFontRequirements(load(bytes), defaultFamily);
}

export async function convertUdf(bytes, { customFonts = new Map(), defaultFamily = defaultUdfFontFamily, loadFallbackFont }) {
  const model = load(bytes);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const embedded = new Map();
  const alternativeFonts = new Map();
  const approximate = new Set();

  async function face(style) {
    const family = styleFamily(style, defaultFamily);
    const key = udfFontFamilyKey(family);
    const faceName = styleFace(style);
    const supplied = customFonts.get(key)?.faces[faceName];
    const fallback = fallbackFamilies.get(key);
    if (!supplied) {
      if (customFonts.size || !fallback) fail(`Belge için “${family}” yazı tipinin ${faceLabels[faceName]} TTF dosyasını ekleyin.`);
      if (key !== udfFontFamilyKey(fallback)) alternativeFonts.set(key, { family, fallback });
    }
    const fontKey = `${supplied ? key : udfFontFamilyKey(fallback)}:${faceName}`;
    if (!embedded.has(fontKey)) {
      const bytes = supplied?.bytes ?? await loadFallbackFont(fallback, faceName);
      const metrics = fontkit.create(bytes);
      const font = await document.embedFont(bytes, {
        subset: supplied?.subset ?? true,
        features: { kern: false, liga: false, clig: false, calt: false },
      });
      const javaFamily = javaFamilyOf.get(udfFontFamilyKey(supplied ? family : fallback)) ?? key;
      const exact = hasJavaMetrics(javaFamily);
      if (!exact) approximate.add(family);
      embedded.set(fontKey, {
        font, metrics, javaFamily, exact, faceName, sizes: new Map(),
        characters: new Set(font.getCharacterSet()), family: supplied ? family : fallback,
      });
    }
    return embedded.get(fontKey);
  }

  const fonts = {
    async get(style, size) {
      const entry = await face(style);
      if (!entry.sizes.has(size)) {
        entry.sizes.set(size, measureFont({ metrics: entry.metrics, familyKey: entry.javaFamily, face: entry.faceName, size, exact: entry.exact }));
      }
      const measure = entry.sizes.get(size);
      const scale = size / entry.metrics.unitsPerEm;
      return {
        pdfFont: entry.font, measure, characters: entry.characters, family: entry.family,
        // java.awt.font.TextLayout.getAdvance: the advances plus, for an italic face,
        // the italic angle times the float ascent (hhea ascender plus half the line gap).
        layoutAdvance(text) {
          const { ascent, lineGap } = entry.metrics.hhea;
          return measure.width(text) + italicAngle(entry) * (ascent + lineGap / 2) * scale;
        },
        // Visual bounds of a string, as java.awt.font.TextLayout.getBounds reports them.
        bounds(text) {
          const run = entry.metrics.layout(text, { kern: false, liga: false, clig: false, calt: false });
          let x = 0;
          let box = null;
          for (const [index, glyph] of run.glyphs.entries()) {
            const glyphBox = glyph.cbox;
            if (glyphBox.maxX > glyphBox.minX || glyphBox.maxY > glyphBox.minY) {
              const placed = { minX: x + glyphBox.minX, maxX: x + glyphBox.maxX, minY: glyphBox.minY, maxY: glyphBox.maxY };
              box = box ? { minX: Math.min(box.minX, placed.minX), maxX: Math.max(box.maxX, placed.maxX), minY: Math.min(box.minY, placed.minY), maxY: Math.max(box.maxY, placed.maxY) } : placed;
            }
            x += run.positions[index].xAdvance;
          }
          // Java reports outline bounds in 26.6 fixed point.
          const fixed = value => Math.round(value * scale * 64) / 64;
          return box ? { x0: fixed(box.minX), x1: fixed(box.maxX), y0: fixed(box.minY), y1: fixed(box.maxY) } : { x0: 0, x1: 0, y0: 0, y1: 0 };
        },
      };
    },
  };

  for (const { family, faces } of documentFontRequirements(model, defaultFamily)) {
    if (!customFonts.size) continue;
    const supplied = customFonts.get(udfFontFamilyKey(family));
    const missing = faces.filter(name => !supplied?.faces[name]);
    if (missing.length) fail(`“${family}” için şu TTF biçimlerini ekleyin: ${missing.map(name => faceLabels[name]).join(", ")}.`);
  }

  const layout = await layoutDocument(model, fonts);
  const images = new Map();
  for (const items of layout.pages.map(pageLayout => pageLayout.items)) {
    const page = document.addPage(layout.pageSize);
    // Background colours go under the text.
    for (const item of items) {
      if (item.type === "fill") page.drawRectangle({ x: item.x, y: item.y, width: item.width, height: item.height, color: rgb(...item.color.map(value => value / 255)) });
    }
    const fontKeys = new Map();
    const text = [];
    for (const item of items) {
      if (item.type !== "text") continue;
      if (!fontKeys.has(item.font.pdfFont)) fontKeys.set(item.font.pdfFont, page.node.newFontDictionary("UdfFont", item.font.pdfFont.ref));
      text.push(setFillingColor(rgb(...item.color.map(value => value / 255))), setFontAndSize(fontKeys.get(item.font.pdfFont), item.size),
        setTextMatrix(1, 0, 0, 1, item.x, item.y), showText(item.font.pdfFont.encodeText(item.text)));
    }
    if (text.length) page.pushOperators(pushGraphicsState(), beginText(), ...text, endText(), popGraphicsState());
    for (const item of items) {
      // Java's default stroke is one point wide with square caps.
      if (item.type === "line") {
        page.drawLine({ start: { x: item.x0, y: item.y }, end: { x: item.x1, y: item.y }, thickness: 1, lineCap: LineCapStyle.Projecting, color: rgb(...item.color.map(value => value / 255)) });
      } else if (item.type === "polygon") {
        const [first, ...rest] = item.points;
        page.pushOperators(pushGraphicsState(), setFillingRgbColor(...item.color.map(value => value / 255)), moveTo(...first),
          ...rest.map(point => lineTo(...point)), closePath(), fill(), popGraphicsState());
      } else if (item.type === "ellipse") {
        page.drawEllipse({ x: item.x, y: item.y, xScale: item.radius, yScale: item.radius, color: rgb(...item.color.map(value => value / 255)) });
      } else if (item.type === "rect" || item.type === "segment") {
        // Table borders with UYAP's border pen: width, cap, join, dash pattern and colour.
        const { pen } = item;
        page.pushOperators(
          pushGraphicsState(), setLineWidth(pen.width), setLineCap(pen.cap), setLineJoin(pen.join), setDashPattern(pen.dash ?? [], 0),
          setStrokingRgbColor(...pen.color.map(value => value / 255)),
          ...(item.type === "rect" ? [rectangle(item.x, item.y, item.width, item.height)] : [moveTo(item.x0, item.y0), lineTo(item.x1, item.y1)]),
          stroke(), popGraphicsState(),
        );
      } else if (item.type === "image") {
        if (!images.has(item.image)) {
          // The original image bytes are embedded unchanged.
          images.set(item.image, item.image.format === "png" ? await document.embedPng(item.image.bytes) : await document.embedJpg(item.image.bytes));
        }
        page.drawImage(images.get(item.image), { x: item.x, y: item.y, width: item.width, height: item.height });
      }
    }
  }
  document.setProducer("PDF Brennt");
  const warnings = [...alternativeFonts.values()].map(({ family, fallback }) =>
    `“${family}” için ${fallback} kullanıldı. Satır ve sayfa düzeni korunur, harf biçimleri biraz farklı görünebilir.`);
  if (approximate.size) warnings.push(`${[...approximate].join(", ")} için UYAP ölçüleri bilinmiyor. Yerleşim yaklaşık olabilir, önizlemeyi kontrol edin.`);
  if (model.signed) warnings.push("Bu UDF e-imzalı. PDF belgenin görüntüsüdür, imza PDF’ye taşınmaz ve doğrulanmaz.");
  return {
    bytes: await document.save(),
    mimeType: "application/pdf",
    pageCount: document.getPageCount(),
    fileCount: 1,
    warnings,
  };
}
