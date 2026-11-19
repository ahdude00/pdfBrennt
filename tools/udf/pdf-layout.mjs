// Extracts positioned text runs, images and painted paths from a PDF for layout comparison.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { join } from "node:path";
import { toolDir } from "./java.mjs";

const standardFontDataUrl = join(toolDir, "..", "..", "node_modules", "pdfjs-dist", "standard_fonts") + "/";
const identity = [1, 0, 0, 1, 0, 0];

function multiply([a, b, c, d, e, f], [g, h, i, j, k, l]) {
  return [a * g + b * i, a * h + b * j, c * g + d * i, c * h + d * j, e * g + f * i + k, e * h + f * j + l];
}

function apply([a, b, c, d, e, f], x, y) {
  return [a * x + c * y + e, b * x + d * y + f];
}

function flat(args) {
  const values = args.length === 1 ? args[0] : args;
  return Array.from(values).slice(0, 6);
}

function rgbOf(args) {
  const value = args[0];
  if (typeof value === "string" && value.startsWith("#")) return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)).join(",");
  return Array.from(args.length === 1 ? value : args).slice(0, 3).map(part => Math.round(part)).join(",");
}

function bounds(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export async function readLayout(bytes) {
  const pdf = await getDocument({ data: new Uint8Array(bytes), standardFontDataUrl, verbosity: 0, isEvalSupported: false }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const [x0, y0, x1, y1] = page.view;
    const runs = [];
    const images = [];
    const strokes = [];
    const fills = [];
    const list = await page.getOperatorList();
    let matrix = identity;
    const stack = [];
    let textMatrix = identity;
    let lineMatrix = identity;
    let fontSize = 0;
    let leading = 0;
    let charSpacing = 0;
    let wordSpacing = 0;
    let color = "0,0,0";
    // Stroke state: width, cap, dash pattern and colour.
    let pen = { width: 1, cap: 0, dash: "", color: "0,0,0" };
    for (let index = 0; index < list.fnArray.length; index++) {
      const fn = list.fnArray[index];
      const args = list.argsArray[index];
      switch (fn) {
        case OPS.save: stack.push({ matrix, color, pen }); break;
        case OPS.restore: ({ matrix, color, pen } = stack.pop() ?? { matrix: identity, color, pen }); break;
        case OPS.transform: matrix = multiply(flat(args), matrix); break;
        case OPS.paintFormXObjectBegin: stack.push({ matrix, color, pen }); if (args?.[0]) matrix = multiply(args[0], matrix); break;
        case OPS.paintFormXObjectEnd: ({ matrix, color, pen } = stack.pop() ?? { matrix: identity, color, pen }); break;
        case OPS.setFillRGBColor: color = rgbOf(args); break;
        case OPS.setStrokeRGBColor: pen = { ...pen, color: rgbOf(args) }; break;
        case OPS.setLineWidth: pen = { ...pen, width: args[0] }; break;
        case OPS.setLineCap: pen = { ...pen, cap: args[0] }; break;
        case OPS.setDash: pen = { ...pen, dash: JSON.stringify([Array.from(args[0] ?? []), args[1] ?? 0]) === "[[],0]" ? "" : JSON.stringify([Array.from(args[0] ?? []), args[1] ?? 0]) }; break;
        case OPS.beginText: textMatrix = lineMatrix = identity; break;
        case OPS.setFont: fontSize = args[1]; break;
        case OPS.setCharSpacing: charSpacing = args[0]; break;
        case OPS.setWordSpacing: wordSpacing = args[0]; break;
        case OPS.setLeading: leading = args[0]; break;
        case OPS.setTextMatrix: textMatrix = lineMatrix = flat(args); break;
        case OPS.moveText: textMatrix = lineMatrix = multiply([1, 0, 0, 1, args[0], args[1]], lineMatrix); break;
        case OPS.setLeadingMoveText: leading = -args[1]; textMatrix = lineMatrix = multiply([1, 0, 0, 1, args[0], args[1]], lineMatrix); break;
        case OPS.nextLine: textMatrix = lineMatrix = multiply([1, 0, 0, 1, 0, -leading], lineMatrix); break;
        case OPS.showText:
        case OPS.showSpacedText: {
          const glyphs = fn === OPS.showText ? args[0] : args[0];
          let text = "";
          let advance = 0;
          const start = apply(multiply(textMatrix, matrix), 0, 0);
          for (const glyph of glyphs) {
            if (typeof glyph === "number") { advance -= glyph / 1000 * fontSize; continue; }
            if (!glyph) continue;
            text += glyph.unicode ?? "";
            advance += (glyph.width ?? 0) / 1000 * fontSize + charSpacing + (glyph.unicode === " " ? wordSpacing : 0);
          }
          textMatrix = multiply([1, 0, 0, 1, advance, 0], textMatrix);
          const scale = Math.hypot(matrix[0], matrix[1]);
          runs.push({ text, x: start[0], y: start[1], size: fontSize * Math.hypot(textMatrix[0], textMatrix[1]) * scale, width: advance * scale, color });
          break;
        }
        case OPS.paintImageXObject:
        case OPS.paintInlineImageXObject:
        case OPS.paintImageMaskXObject: {
          const box = bounds([[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => apply(matrix, u, v)));
          images.push({ x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 });
          break;
        }
        case OPS.constructPath: {
          const [paint, data, minMax] = args;
          if (!minMax || !Number.isFinite(minMax[0])) break;
          const box = bounds([[minMax[0], minMax[1]], [minMax[2], minMax[3]], [minMax[0], minMax[3]], [minMax[2], minMax[1]]].map(([x, y]) => apply(matrix, x, y)));
          // The pen width is scaled by the current transformation.
          if (paint === OPS.stroke || paint === OPS.closeStroke) strokes.push({ ...box, width: pen.width * Math.hypot(matrix[0], matrix[1]), cap: pen.cap, dash: pen.dash, color: pen.color });
          else if (paint === OPS.fill || paint === OPS.eoFill || paint === OPS.fillStroke || paint === OPS.closeFillStroke) fills.push({ ...box, color });
          break;
        }
        default: break;
      }
    }
    pages.push({ width: x1 - x0, height: y1 - y0, runs, images, strokes, fills });
  }
  return pages;
}
