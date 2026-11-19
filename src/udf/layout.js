// Lays a parsed UDF out the way UYAP Editör does and returns positioned drawing
// items per page. Coordinates are PDF points with the origin at the bottom left.
// Every rule here was measured against UYAP Editör exports; see tools/udf.
import { fail, number, readsAsJavaInt } from "./document.js";
import { bulletShapes, markerKind, numberLabel } from "./lists.js";

const defaultTab = 72;
// A paragraph mark that forms a run of its own (as after an image) is one point wide.
const loneNewlineWidth = 1;

// The paper of a page: pageFormat's mediaSizeName picks one of these Java MediaSizes
// (in points), anything else is A4. A landscape page turns the paper and its margins.
const millimetres = value => value / 25.4 * 72;
const papers = [
  [3.87 * 72, 7.5 * 72], // 0 Monarch envelope
  [millimetres(210), millimetres(297)], // 1 A4
  [millimetres(148), millimetres(210)], // 2 A5
  [612, 792], // 3 Letter
  [millimetres(182), millimetres(257)], // 4 JIS B5
  [612, 1008], // 5 Legal
  [522, 756], // 6 Executive
  [millimetres(162), millimetres(229)], // 7 C5 envelope
  [297, 684], // 8 #10 envelope
  [millimetres(110), millimetres(220)], // 9 DL envelope
];

export function paperOf({ media, landscape }) {
  const [width, height] = papers[media] ?? papers[1];
  return landscape ? [height, width] : [width, height];
}

export function pageGeometry(margins, paper = paperOf({ media: 1, landscape: false })) {
  const { left, right, top, bottom } = margins;
  const [width, height] = paper;
  // UYAP's export sizes the PDF page from the imageable area plus twice its offset.
  const pageSize = [width + left - right, height + top - bottom].map(value => Math.round(value * 100) / 100);
  const originX = Math.floor(left) + 1;
  const contentWidth = Math.floor(width - left - right);
  // Swing paginates within the A4 imageable height. Because the PDF page grows by
  // (top - bottom), the lowest allowed row bottom lands at the top margin.
  const bodyTop = pageSize[1] - Math.floor(top) + 1;
  // Swing paginates ceil(imageable height) below the body top; rows must end above that cut.
  return { pageSize, originX, contentWidth, top: bodyTop, bottom: bodyTop - Math.ceil(height - top - bottom) };
}

function color(value) {
  const raw = number(value, -16777216, -2147483648, 4294967295) >>> 0;
  return [(raw >>> 16) & 255, (raw >>> 8) & 255, raw & 255];
}

function flag(style, name) {
  const value = style[name];
  if (value != null && !["true", "false"].includes(value)) fail();
  return value === "true";
}

function checkStyle(style) {
  for (const name of ["strikethrough", "subscript", "superscript", "underline"]) flag(style, name);
}

// TabSet is "position:align:leader" per stop, comma separated. Alignments follow
// javax.swing.text.TabStop: 0 left, 1 right, 2 center, 4 decimal.
function tabStops(value) {
  if (value == null || !value.trim()) return null;
  const stops = value.split(",").map(entry => {
    const [position, align = "0", leader = "0"] = entry.split(":");
    const stop = { position: number(position, NaN, 0, 5000), align: number(align, NaN, 0, 5) };
    if (![0, 1, 2, 4].includes(stop.align)) fail("Bu UDF desteklenmeyen bir sekme hizalaması içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
    // UYAP Editör stores tab leaders but never paints them.
    number(leader, NaN, 0, 5);
    return stop;
  });
  for (let index = 1; index < stops.length; index++) if (stops[index].position < stops[index - 1].position) fail();
  return stops;
}

// Paragraph and run sizes UYAP cannot read were dropped when the document was read;
// a style's size is only taken as Integer.parseInt reads it.
function sizeOf(style, fallback) {
  if (style.size == null) return fallback;
  if (!readsAsJavaInt(style.size)) fail();
  const size = Number(style.size);
  if (size < 1 || size > 96) fail();
  return size;
}

async function textItem(style, piece, fonts, baseSize) {
  // Swing's StyleContext draws sub- and superscript two points smaller.
  const superscript = flag(style, "superscript");
  const subscript = flag(style, "subscript");
  const size = sizeOf(style, baseSize) - (superscript || subscript ? 2 : 0);
  if (size < 1) fail();
  const font = await fonts.get(style, size);
  for (const character of piece) {
    if (character !== "\t" && character !== "\n" && !font.characters.has(character.codePointAt(0))) {
      fail(`“${font.family}” yazı tipinde belgedeki bazı karakterler bulunamadı.`);
    }
  }
  const { measure } = font;
  // UYAP's text view is LineMetrics height + 1 tall, a third taller for superscript.
  // Its vertical alignment is 1 for superscript and (h − (d + a / 2)) / h for subscript,
  // with h that height, d the Java descent − 2 and a the Java ascent + 6, which puts
  // subscript above the baseline of the line.
  const viewHeight = float(measure.floatHeight + 1);
  let { height, align } = measure;
  if (superscript) {
    height = Math.trunc(float(viewHeight + float(viewHeight / 3)));
    align = 1;
  } else if (subscript) {
    align = float(float(viewHeight - float((measure.javaDescent - 2) + float((measure.javaAscent + 6) / 2))) / viewHeight);
  }
  return {
    kind: "text", piece, font, size,
    width: piece === "\t" || piece === "\n" ? 0 : measure.width(piece),
    height, ascent: measure.ascent, gap: measure.gap, align, measure,
    color: color(style.foreground), underline: flag(style, "underline"), strike: flag(style, "strikethrough"),
    background: style.background != null ? color(style.background) : null,
  };
}

async function paragraphTokens(block, fonts, baseSize) {
  const tokens = [];
  let end = null;
  for (const run of block.runs) {
    checkStyle(run.style);
    if (run.type === "image") {
      const { width, height } = run.image;
      const item = { kind: "image", image: run.image, width: Math.trunc(width + 1e-6), height: Math.trunc(height + 1e-6) };
      // Without a space around it, an image cannot be separated from the adjacent word.
      const previous = tokens.at(-1);
      if (previous?.type === "word") {
        previous.items.push(item);
        previous.width += item.width;
      } else tokens.push({ type: "word", items: [item], width: item.width });
      continue;
    }
    const text = run.text.replace(/[\r​]/gu, "");
    if (text.includes("\n")) {
      end = await textItem(run.style, "\n", fonts, baseSize);
      if (!text.replace(/\n/gu, "")) end.width = loneNewlineWidth;
    }
    for (const piece of text.replace(/\n/gu, "").match(/\t| +|[^ \t]+/gu) ?? []) {
      const item = await textItem(run.style, piece, fonts, baseSize);
      const type = piece === "\t" ? "tab" : piece.startsWith(" ") ? "space" : "word";
      const previous = tokens.at(-1);
      if (type === "word" && previous?.type === "word") {
        previous.items.push(item);
        previous.width += item.width;
      } else tokens.push({ type, items: [item], width: item.width });
    }
  }
  end ??= await textItem(block.runs.at(-1)?.style ?? block.settings, "\n", fonts, baseSize);
  // After a space the newline is a view of its own, one point wide; after a word it
  // belongs to the word's view and adds nothing.
  if (tokens.at(-1)?.type === "space") end.width = loneNewlineWidth;
  return { tokens, end };
}

const float = Math.fround;

function isSpaceItem(item) {
  return item.kind === "text" && item.piece !== "\n" && item.piece !== "\t" && !item.piece.trim();
}

// Horizontal offsets of the items of one row, as UYAP Editör's row view lays them out
// in Java float arithmetic. Every space character is a view of its own.
// Pass 1 floors each span and carries the remainder, adding a point once it exceeds 0.5.
// A justified row (not the last of its paragraph) then sets every inner space to the
// floored share of the free width, carries that remainder too, and spreads what the
// rounding left over the inner spaces evenly. Leading spaces collapse to zero width.
function rowOffsets(items, target, justify) {
  const views = [];
  for (const [index, item] of items.entries()) {
    if (isSpaceItem(item)) {
      const pref = float(item.measure.width(" "));
      for (let count = 0; count < item.piece.length; count++) views.push({ index, pref, space: true });
    } else views.push({ index, pref: float(item.advance), space: false });
  }
  const n = views.length;
  const offsets = new Array(n);
  const spans = new Array(n);
  let carry = 0;
  let position = 0;
  let total = 0;
  for (let index = 0; index < n; index++) {
    const { pref } = views[index];
    spans[index] = Math.floor(pref);
    carry = float(carry + float(pref - spans[index]));
    if (carry > 0.5) {
      spans[index] += 1;
      carry = float(carry - 1);
    }
    offsets[index] = position;
    position = Math.trunc(float(position + spans[index]));
    total = float(total + pref);
  }
  if (justify) justifyRow(views, offsets, spans, target, total);
  const result = items.map(() => []);
  for (let index = 0; index < n; index++) result[views[index].index].push({ x: offsets[index], span: spans[index] });
  return result;
}

function justifyRow(views, offsets, spans, target, total) {
  const n = views.length;
  let spaces = 0;
  let first = 0;
  let found = false;
  let end = n;
  for (let index = 0; index < n; index++) {
    if (views[index].space) {
      spaces++;
      total = float(total - views[index].pref);
    } else if (!found) {
      first = index;
      found = true;
    }
  }
  for (let index = n - 1; index >= 0 && views[index].space; index--) {
    spaces--;
    end--;
  }
  // UYAP gives up on rows without a space before the trailing ones and keeps pass 1.
  if (!spaces) return;
  let lead = -1;
  for (let index = 0; index < n && views[index].space; index++) {
    lead = index;
    spaces--;
    offsets[index] = spans[index] = 0;
  }
  lead++;
  const inner = spaces;
  const room = float(target - total);
  const share = inner > 0 ? float(room / inner) : lead >= n - 1 ? 0 : float(room / (n - lead - 1));
  const whole = Math.floor(share);
  let carry = 0;
  let position = 0;
  for (let index = lead; index < n; index++) {
    if (views[index].space) {
      carry = float(carry + float(share - whole));
      spans[index] = whole;
      if (carry >= 0.5) {
        spans[index] += 1;
        carry = float(carry - 1);
      }
      if (--spaces === 0) {
        for (let next = index; next < n; next++) {
          offsets[next] = Math.trunc(position);
          position = float(spans[next] + offsets[next]);
        }
        break;
      }
    }
    offsets[index] = Math.trunc(position);
    position = float(spans[index] + offsets[index]);
  }
  function spread(extra) {
    let at = 0;
    for (let index = first; index < end; index++) {
      if (views[index].space) spans[index] = float(spans[index] + extra);
      offsets[index] = at;
      at = float(spans[index] + offsets[index]);
    }
    return at;
  }
  let rest = float(float(carry + target) - position);
  position = spread(float(rest / inner));
  if (n - 1 > end && position < target) {
    rest = float(target - position);
    position = spread(float(rest / inner));
  }
  for (let index = end; index < n && position < target; index++) {
    offsets[index] = position;
    spans[index] = 0;
  }
}

// Places the items of one row: text starts trunc((H - h) * align) below the top,
// an image sits on the row bottom, and an image row is taller by the text gap.
function finishRow(line, spacing) {
  // The row is as tall as the largest part above the alignment point plus the largest
  // part below it, each view split at trunc(align × height). An image aligns at its
  // bottom. With text alone this is usually the tallest view; an image row is taller
  // by the text gap; sub- and superscript make it taller still.
  let above = 0;
  let below = 0;
  for (const item of line.items) {
    const part = item.kind === "image" ? item.height : Math.trunc(float(item.align * item.height));
    above = Math.max(above, part);
    below = Math.max(below, item.height - part);
  }
  const height = above + below;
  const padding = Math.floor(height * spacing / 2);
  for (const item of line.items) {
    item.top = padding + (item.kind === "image" ? height - item.height : Math.trunc(float((height - item.height) * item.align)));
  }
  line.height = height + 2 * padding;
}

export async function layoutParagraph(block, width, fonts) {
  const { settings } = block;
  const align = number(settings.Alignment, 0, 0, 3);
  if (!Number.isInteger(align)) fail();
  const left = Math.trunc(number(settings.LeftIndent, 0, -width, width - 4));
  const right = Math.trunc(number(settings.RightIndent, 0, -width, width - left - 4));
  const firstIndent = Math.trunc(number(settings.FirstLineIndent, 0, -width, width - right - left - 4));
  // Rows after the first are indented by Hanging on top of the left indent.
  const hanging = Math.trunc(number(settings.Hanging, 0, -width, width - right - left - 4));
  if (left < 0 || right < 0 || left + firstIndent < 0 || left + hanging < 0) fail("Bu UDF negatif girinti içeriyor. Bu girinti henüz birebir dönüştürülemiyor.");
  const spacing = number(settings.LineSpacing, 0, 0, 10);
  const above = Math.trunc(number(settings.SpaceAbove, 0, 0, 2000));
  const below = Math.trunc(number(settings.SpaceBelow, 0, 0, 2000));
  const baseSize = sizeOf(settings, 12);
  const { tokens, end } = await paragraphTokens(block, fonts, baseSize);

  const lines = [];
  let line;
  function startLine() {
    const indent = left + (lines.length ? hanging : firstIndent);
    line = { items: [], used: 0, indent, available: width - indent - right };
    lines.push(line);
  }
  function add(item, advance = item.width) {
    line.items.push({ ...item, advance, x: line.used, flow: line.used });
    line.used += advance;
  }
  const stops = tabStops(settings.TabSet);
  // Width of the text after a tab up to the next tab, or up to a decimal point.
  function tabPad(tokenIndex, decimal) {
    let total = 0;
    for (const token of tokens.slice(tokenIndex + 1)) {
      if (token.type === "tab") break;
      for (const item of token.items) {
        if (decimal && item.kind === "text" && item.piece.includes(".")) return total + item.measure.width(item.piece.slice(0, item.piece.indexOf(".")));
        total += item.width;
      }
    }
    return total;
  }
  startLine();
  for (const [tokenIndex, token] of tokens.entries()) {
    if (token.type === "tab") {
      // Swing's ParagraphView.nextTabStop, measured from the left indent.
      const position = line.indent - left + line.used;
      let advance;
      if (!stops) advance = (Math.floor(position / defaultTab) + 1) * defaultTab - position;
      else {
        const stop = stops.find(entry => entry.position > position + 0.01);
        if (!stop) advance = 5;
        else if (stop.align === 0) advance = stop.position - position;
        else {
          const pad = tabPad(tokenIndex, stop.align === 4);
          advance = Math.max(0, stop.position - (stop.align === 2 ? pad / 2 : pad) - position);
        }
      }
      if (line.used + advance > line.available) fail("Bu UDF satırı aşan bir sekme içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
      add(token.items[0], advance);
      continue;
    }
    const visible = line.items.some(item => item.kind === "image" || item.piece.trim());
    // Swing breaks after the spaces that follow a word, so a word stays on the line
    // only when the spaces after it fit as well.
    // The break test allows one point more than alignment uses.
    const following = tokens[tokenIndex + 1]?.type === "space" ? tokens[tokenIndex + 1].width : 0;
    if (token.type !== "space" && line.used + token.width + following > line.available + 1 && visible) startLine();
    if (token.type === "space" && !line.items.length && lines.length > 1) continue;
    if (token.type !== "space" && line.used + token.width > line.available) {
      fail("Bu UDF satıra sığmayan çok uzun bir sözcük veya görsel içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
    }
    for (const item of token.items) add(item);
  }
  add(end);

  for (const [index, current] of lines.entries()) {
    const items = current.items;
    // Trailing spaces do not take part in alignment.
    let last = items.length;
    while (last > 0 && items[last - 1].kind === "text" && (items[last - 1].piece === "\n" ? !items[last - 1].width : !items[last - 1].piece.trim())) last--;
    const ending = items.slice(last);
    let used = items.slice(0, last).reduce((total, item) => total + item.advance, 0)
      + ending.filter(item => item.piece === "\n").reduce((total, item) => total + item.width, 0);
    // Spaces before the paragraph end stay on the last row and count, with the
    // newline after them, toward its width. Wrapped rows drop their trailing spaces.
    if (index === lines.length - 1) used += ending.filter(isSpaceItem).reduce((total, item) => total + item.advance, 0);
    const justify = align === 3 && index < lines.length - 1;
    const free = current.available - Math.trunc(used);
    // The row box: the full width when justified, else its truncated content width.
    // UYAP clips the box of every view to it when painting.
    current.boxWidth = justify ? current.available : Math.trunc(used);
    current.x = current.indent + (justify ? 0 : Math.trunc(free * (align === 1 ? 0.5 : align === 2 ? 1 : 0)));
    const views = rowOffsets(items, current.available, justify);
    for (const [itemIndex, item] of items.entries()) {
      item.views = views[itemIndex];
      item.x = item.views[0].x;
    }
    finishRow(current, spacing);
  }
  // The list marker hangs 15 points in front of the left indent, in black. Its size
  // and font come from the first view of the paragraph; it is centred on the first
  // row: the bullet top lies trunc(rowHeight / 2) − trunc(s / 2) + 1 below the row top
  // (s = size / 3), the label baseline h + trunc(rowHeight / 2) − trunc(h / 2) + 1
  // (h = size / 2). A label moves left by its rounded width − 10, or by 2 when that
  // width is at most 12; numbered styles also add the first-line indent.
  let marker = null;
  const kind = block.list ? markerKind(block.list) : null;
  if (kind) {
    const firstRun = block.runs[0];
    if (firstRun?.type === "image") fail("Bu UDF görselle başlayan bir liste paragrafı içeriyor. Bu liste henüz birebir dönüştürülemiyor.");
    const style = firstRun?.style ?? settings;
    const size = sizeOf(style, baseSize);
    const rowHeight = lines[0].height;
    if (kind.kind === "bullet") {
      const s = Math.trunc(size / 3);
      marker = { kind: "shapes", x: left - 15, top: Math.trunc(rowHeight / 2) - Math.trunc(s / 2) + 1, shapes: bulletShapes(kind.type, s) };
    } else {
      const text = kind.kind === "outline" ? block.list.outline : numberLabel(kind.type, block.list.value);
      const item = await textItem(style, text, fonts, baseSize);
      // FontMetrics.stringWidth rounds the advance.
      const width = Math.trunc(0.5 + float(item.width));
      const shift = width > 12 ? width - 10 : 2;
      const h = Math.trunc(size / 2);
      const indent = kind.lineIndent ? number(settings.FirstLineIndent, 0, -10000, 10000) : 0;
      marker = { kind: "text", item: { ...item, color: [0, 0, 0] }, x: float(float(left + float(indent)) - 15 - shift), baseline: h + Math.trunc(rowHeight / 2) - Math.trunc(h / 2) + 1 };
    }
  }
  return { above, below, lines, marker };
}

// UYAP's border stroke (swing.wp.m): plain lines are borderWidth wide (0 means half a
// point) with square caps; dashed, dotted and dotted-dashed lines repeat multiples of
// the width with butt caps and bevel joins. Patterned lines of width 0 make UYAP fail.
const borderPatterns = { "borderStyle-dashed": [4, 2], "borderStyle-dotted": [2, 2], "borderStyle-dottedDashed": [4, 2, 2, 2] };
function borderPen(border) {
  const penColor = border.color == null ? [0, 0, 0] : color(String(border.color));
  if (border.style == null || border.style === "borderStyle-plain") {
    if (border.width < 0) fail();
    return { width: border.width === 0 ? 0.5 : border.width, cap: 2, join: 0, dash: null, color: penColor };
  }
  const pattern = borderPatterns[border.style];
  if (!pattern) return { width: 0.5, cap: 2, join: 0, dash: null, color: penColor };
  if (border.width <= 0) fail("Bu UDF’de kalınlığı belirtilmemiş kesik veya noktalı bir tablo kenarlığı var. UYAP Editör de bu belgeyi PDF’ye dönüştüremiyor.");
  return { width: border.width, cap: 0, join: 2, dash: pattern.map(value => float(value * border.width)), color: penColor };
}

// A border around a box: a rectangle, or with spec bit 1 only the chosen sides, drawn
// as UYAP draws them with Graphics.drawLine from integer corners.
function borderItems(box, border, target) {
  const pen = borderPen(border);
  if (!(border.spec & 1)) {
    target.push({ type: "rect", ...box, pen });
    return;
  }
  const { x, y, width, height } = box;
  const top = y + height;
  if (border.spec & 2) target.push({ type: "segment", x0: x, y0: top, x1: x + width - 1, y1: top, pen });
  if (border.spec & 4) target.push({ type: "segment", x0: x + width, y0: top, x1: x + width, y1: top - (height - 1), pen });
  if (border.spec & 8) target.push({ type: "segment", x0: x + width, y0: y, x1: x + 1, y1: y, pen });
  if (border.spec & 16) target.push({ type: "segment", x0: x, y0: y, x1: x, y1: top - 1, pen });
}

function columnWidths(spans, total) {
  const sum = spans.reduce((a, b) => a + b, 0);
  const widths = [];
  let previous = 0;
  let cumulative = 0;
  for (const span of spans) {
    cumulative += span;
    const edge = Math.round(total * cumulative / sum);
    widths.push(edge - previous);
    previous = edge;
  }
  return widths;
}

export async function layoutDocument(model, fonts) {
  // A landscape page turns the paper's margins with it: the bottom margin becomes the
  // left one, the top the right, the left the top and the right the bottom.
  const paper = paperOf(model.paper ?? { media: 1, landscape: false });
  const { margins } = model;
  const pageMargins = model.paper?.landscape ? { ...margins, left: margins.bottom, right: margins.top, top: margins.left, bottom: margins.right } : margins;
  const geometry = pageGeometry(pageMargins, paper);
  const paperHeight = paper[1];

  function placeLine(line, x0, top, target) {
    const lastItem = line.items.at(-1);
    for (const item of line.items) {
      const x = x0 + line.x + item.x;
      if (item.kind === "image") {
        target.push({ type: "image", image: item.image, x, y: top - item.top - item.height, width: item.width, height: item.height });
        continue;
      }
      const bottom = top - item.top - item.height;
      // A background colour fills the box of every view, its span wide, clipped to the row box.
      if (item.background) {
        for (const view of item.views) {
          const width = Math.min(view.span, line.boxWidth - view.x);
          if (width > 0) target.push({ type: "fill", x: x0 + line.x + view.x, y: bottom, width, height: item.height, color: item.background });
        }
      }
      if (item.piece === "\n") continue;
      if (item.piece !== "\t") {
        target.push({ type: "text", text: item.piece, font: item.font, size: item.size, color: item.color, x, y: top - item.top - item.ascent });
      }
      if (item.underline || item.strike) {
        // UYAP draws the lines of every view from its truncated position over its own
        // truncated natural width, not its justified span. A tab reaches its stop. The
        // last view of a row loses its trailing whitespace. The underline lies
        // 4 − descent below the box, the strike-through descent − 2 plus
        // trunc(0.3 × (ascent + 6)) above it (Java integer ascent and descent).
        const { javaAscent, javaDescent } = item.measure;
        const levels = [
          ...(item.underline ? [bottom - (4 - javaDescent)] : []),
          ...(item.strike ? [bottom + (javaDescent - 2) + Math.trunc(float((javaAscent + 6) * float(0.3)))] : []),
        ];
        const space = isSpaceItem(item);
        for (const [viewIndex, view] of item.views.entries()) {
          if (space && item === lastItem && viewIndex === item.views.length - 1) continue;
          const start = Math.trunc(x0 + line.x + view.x);
          const length = item.piece === "\t" ? Math.trunc(x0 + line.x + item.flow + item.advance) - start
            : Math.trunc(space ? item.measure.width(" ") : item.width);
          if (length > 0) for (const y of levels) target.push({ type: "line", x0: start, x1: start + length, y, color: item.color });
        }
      }
    }
  }

  function drawMarker(marker, x0, top, target) {
    if (marker.kind === "text") {
      const { item } = marker;
      target.push({ type: "text", text: item.piece, font: item.font, size: item.size, color: item.color, x: x0 + marker.x, y: top - marker.baseline });
      return;
    }
    // Shapes are given in Java coordinates from the bullet's top-left corner.
    const left = x0 + marker.x;
    const upper = top - marker.top;
    for (const shape of marker.shapes) {
      const fill = shape.color ?? [0, 0, 0];
      if (shape.ellipse) {
        const [x, y, width] = shape.ellipse;
        target.push({ type: "ellipse", x: left + x + width / 2, y: upper - y - width / 2, radius: width / 2, color: fill });
      } else {
        target.push({ type: "polygon", points: shape.polygon.map(([x, y]) => [left + x, upper - y]), color: fill });
      }
    }
  }

  async function layoutBlocks(blocks, width) {
    const laid = [];
    let height = 0;
    for (const block of blocks) {
      const paragraph = await layoutParagraph(block, width, fonts);
      laid.push(paragraph);
      height += paragraph.above + paragraph.lines.reduce((total, line) => total + line.height, 0) + paragraph.below;
    }
    return { laid, height };
  }

  // Turns blocks into a flow of rows: paragraph lines and table rows.
  async function flow(blocks) {
    const rows = [];
    for (const block of blocks) {
      if (block.type === "pageBreak") {
        rows.push({ pageBreak: true });
        continue;
      }
      if (block.type === "paragraph") {
        const paragraph = await layoutParagraph(block, geometry.contentWidth, fonts);
        paragraph.lines.forEach((line, index) => rows.push({
          above: index === 0 ? paragraph.above : 0,
          below: index === paragraph.lines.length - 1 ? paragraph.below : 0,
          first: index === 0,
          height: line.height,
          draw(target, top) {
            placeLine(line, geometry.originX, top, target);
            if (index === 0 && paragraph.marker) drawMarker(paragraph.marker, geometry.originX, top, target);
          },
        }));
        continue;
      }
      // A row follows its own columnSpans, else the table's when it has as many cells as
      // columns; any other row is split evenly.
      const columnWidthsOf = row => {
        const spans = row.spans?.length === row.cells.length ? row.spans : row.cells.length === block.spans.length ? block.spans : row.cells.map(() => 1);
        return columnWidths(spans, geometry.contentWidth);
      };
      const tableRows = [];
      for (const row of block.rows) {
        const widths = columnWidthsOf(row);
        const cells = [];
        let rowHeight = 0;
        for (const [index, cell] of row.cells.entries()) {
          const content = await layoutBlocks(cell.blocks, widths[index]);
          cells.push(content);
          rowHeight = Math.max(rowHeight, content.height);
        }
        // Every line of every cell with its offset from the cell top.
        const cellLines = cells.map(content => {
          const entries = [];
          let offset = 0;
          for (const paragraph of content.laid) {
            offset += paragraph.above;
            for (const [lineIndex, line] of paragraph.lines.entries()) {
              entries.push({ line, top: offset, bottom: offset + line.height, marker: lineIndex === 0 ? paragraph.marker : null });
              offset += line.height;
            }
            offset += paragraph.below;
          }
          return entries;
        });
        // Draws the given lines of every cell, each cell shifted up by its own offset,
        // with cell borders as tall as the part.
        const drawPart = (target, top, height, lines, shifts) => {
          let x = geometry.originX;
          for (const [index, entries] of lines.entries()) {
            for (const entry of entries) {
              placeLine(entry.line, x, top - entry.top + shifts[index], target);
              if (entry.marker) drawMarker(entry.marker, x, top - entry.top + shifts[index], target);
            }
            if (block.border === "borderCell") borderItems({ x, y: top - height, width: widths[index], height }, row.cells[index].border, target);
            x += widths[index];
          }
        };
        // A row, or what is left of it after a page break. UYAP splits a row at the page
        // cut: lines that end above the cut stay, the part reaches down to the cut, and
        // the remaining lines continue on the next page, as often as needed.
        const part = lines => {
          const shifts = lines.map(entries => entries[0]?.top ?? 0);
          const height = lines === cellLines ? rowHeight : Math.max(0, ...lines.map((entries, index) => entries.length ? entries.at(-1).bottom - shifts[index] : 0));
          return {
            height, lines,
            draw: (target, top) => drawPart(target, top, height, lines, shifts),
            split(target, top, cut) {
              const room = top - cut;
              drawPart(target, top, room, lines.map((entries, index) => entries.filter(entry => entry.bottom - shifts[index] <= room)), shifts);
              return part(lines.map((entries, index) => entries.filter(entry => entry.bottom - shifts[index] > room)));
            },
          };
        };
        rows.push({ above: 0, below: 0, first: true, table: block, tableRow: row, ...part(cellLines) });
      }
    }
    return rows;
  }

  // UYAP paints a table in its continuous document view, where pages follow each
  // other every 861 points (the A4 page height plus the gap between pages).
  const pagePitch = Math.floor(paperHeight) + 20;

  // Row and table borders are drawn once all their parts are placed. A row border is
  // one rectangle from the row's first top to its last bottom in that continuous view,
  // seen through every page it touches. A table border is drawn per page: from the
  // first part on the page down to the page cut while the table goes on, else down
  // to its last part.
  function drawTableBorders(placements, pages, limit) {
    const byRow = new Map();
    const byTable = new Map();
    for (const placement of placements) {
      if (placement.table.border === "borderRow") byRow.set(placement.row, [...(byRow.get(placement.row) ?? []), placement]);
      if (placement.table.border === "borderTable") byTable.set(placement.table, [...(byTable.get(placement.table) ?? []), placement]);
    }
    for (const [row, parts] of byRow) {
      const first = parts[0];
      const last = parts.at(-1);
      const top = first.top;
      const bottom = last.top - last.height;
      for (const placement of parts) {
        const pageTop = top + (placement.page - first.page) * pagePitch;
        const pageBottom = bottom - (last.page - placement.page) * pagePitch;
        borderItems({ x: geometry.originX, y: pageBottom, width: geometry.contentWidth, height: pageTop - pageBottom }, row.border, pages[placement.page].items);
      }
    }
    for (const [table, parts] of byTable) {
      const lastPage = parts.at(-1).page;
      for (const pageIndex of new Set(parts.map(placement => placement.page))) {
        const onPage = parts.filter(placement => placement.page === pageIndex);
        const top = onPage[0].top;
        const bottom = pageIndex < lastPage ? limit : onPage.at(-1).top - onPage.at(-1).height;
        borderItems({ x: geometry.originX, y: bottom, width: geometry.contentWidth, height: top - bottom }, table.borderStyle, pages[pageIndex].items);
      }
    }
  }

  function sectionHeight(rows) {
    return rows.reduce((total, row) => total + row.above + row.height + row.below, 0);
  }

  function drawSection(rows, top, target) {
    let y = top;
    for (const row of rows) {
      y -= row.above;
      row.draw(target, y);
      y -= row.height + row.below;
    }
  }

  // Header and footer repeat on every page. The header hangs from its offset and
  // pushes the body down; the footer stands on its offset and raises the body limit.
  const header = await flow(model.header);
  const footer = await flow(model.footer);
  const headerTop = geometry.pageSize[1] - Math.floor(model.margins.header) + 1;
  const footerBottom = geometry.pageSize[1] - Math.floor(paperHeight - model.margins.footer) + 1;
  const headerHeight = sectionHeight(header);
  const footerHeight = sectionHeight(footer);
  const bodyTop = header.length ? Math.min(geometry.top, headerTop - headerHeight) : geometry.top;
  const bodyLimit = footer.length ? Math.max(geometry.bottom, footerBottom + footerHeight) : geometry.bottom;

  const pages = [];
  let page;
  let y;
  function newPage() {
    if (pages.length >= 500) fail("Bu UDF 500 sayfa sınırını aşıyor.");
    page = { items: [] };
    pages.push(page);
    y = bodyTop;
    if (header.length) drawSection(header, headerTop, page.items);
    if (footer.length) drawSection(footer, footerBottom + footerHeight, page.items);
  }
  function fits(height) {
    return y - height >= bodyLimit;
  }

  newPage();
  const placements = [];
  const place = (row, height) => {
    if (row.table) placements.push({ table: row.table, row: row.tableRow, page: pages.length - 1, top: y, height });
  };
  for (const row of await flow(model.blocks)) {
    if (row.pageBreak) {
      newPage();
      continue;
    }
    y -= row.above;
    if (!fits(row.height) && row.split) {
      let rest = row;
      while (!fits(rest.height)) {
        const fresh = y === bodyTop;
        const next = rest.split(page.items, y, bodyLimit);
        place(row, y - bodyLimit);
        // A line taller than a whole page would never fit.
        if (fresh && next.lines.every((entries, index) => entries.length === rest.lines[index].length)) {
          fail("Bu UDF sayfaya sığmayan bir tablo satırı içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
        }
        newPage();
        rest = next;
      }
      rest.draw(page.items, y);
      place(row, rest.height);
      y -= rest.height;
      continue;
    }
    if (!fits(row.height)) {
      newPage();
      if (row.first) y -= row.above;
      if (!fits(row.height)) fail(row.table ? "Bu UDF sayfaya sığmayan bir tablo satırı içeriyor. Bu düzen henüz birebir dönüştürülemiyor." : "Bu UDF sayfaya sığmayan bir satır içeriyor.");
    }
    row.draw(page.items, y);
    place(row, row.height);
    y -= row.height + row.below;
  }
  drawTableBorders(placements, pages, bodyLimit);

  // Page numbers need the page count, so they are added last. UYAP draws the number
  // with TextLayout inside the section box: its baseline sits two points below the
  // box top plus the truncated height of the label's visual bounds, or two points
  // above the box bottom. It starts at the box left, or is centred or right aligned
  // over the content width with the truncated advance.
  const sections = [[model.pageNumbers?.header, headerTop, headerHeight], [model.pageNumbers?.footer, footerBottom + footerHeight, footerHeight]];
  for (const [number, top, height] of sections) {
    if (!number) continue;
    if (!Number.isInteger(number.size) || number.size < 1 || number.size > 96) fail();
    const font = await fonts.get(number.style, number.size);
    const textColor = color(String(number.color));
    for (const [index, current] of pages.entries()) {
      if (index === 0 && (number.spec & 4096 || (number.spec & 8192 && pages.length <= 1))) continue;
      const label = `${number.fore}${number.start + index}${number.spec & 2048 ? `${number.separator}${pages.length}` : ""}${number.after}`;
      for (const character of label) {
        if (!font.characters.has(character.codePointAt(0))) fail(`“${font.family}” yazı tipinde sayfa numarasındaki bazı karakterler bulunamadı.`);
      }
      const advance = Math.trunc(font.layoutAdvance(label));
      const bounds = font.bounds(label);
      let x = geometry.originX;
      if (number.spec & 32) x += Math.trunc((geometry.contentWidth - advance) / 2);
      else if (number.spec & 64) x += geometry.contentWidth - advance - 1;
      const y = number.spec & 8 ? top - height + 2 : top - Math.trunc(bounds.y1 - bounds.y0) - 2;
      current.items.push({ type: "text", text: label, font, size: number.size, color: textColor, x, y });
    }
  }
  return { pageSize: geometry.pageSize, pages };
}
