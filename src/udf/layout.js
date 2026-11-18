// Lays a parsed UDF out the way UYAP Editör does and returns positioned drawing
// items per page. Coordinates are PDF points with the origin at the bottom left.
// Every rule here was measured against UYAP Editör exports; see tools/udf.
import { fail, number } from "./document.js";

const a4 = [595.28, 841.89];
const defaultTab = 72;
// A paragraph mark that forms a run of its own (as after an image) is one point wide.
const loneNewlineWidth = 1;

export function pageGeometry({ left, right, top, bottom }) {
  const [width, height] = a4;
  // UYAP's export sizes the PDF page from the imageable area plus twice its offset.
  const pageSize = [width + left - right, height + top - bottom].map(value => Math.round(value * 100) / 100);
  const originX = Math.floor(left) + 1;
  const contentWidth = Math.floor(width - left - right);
  // Swing paginates within the A4 imageable height. Because the PDF page grows by
  // (top - bottom), the lowest allowed row bottom lands at the top margin.
  return { pageSize, originX, contentWidth, top: pageSize[1] - Math.floor(top) + 1, bottom: top };
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
  if (style.background != null && !["-1", "16777215", "0"].includes(String(style.background))) {
    fail("Bu UDF vurgulanmış (arka plan renkli) metin içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
  }
  if (flag(style, "strikethrough") || flag(style, "subscript") || flag(style, "superscript")) {
    fail("Bu UDF üstü çizili, alt simge veya üst simge metin içeriyor. Bu öğe henüz birebir dönüştürülemiyor.");
  }
}

function sizeOf(style, fallback) {
  const size = number(style.size, fallback, 1, 96);
  if (!Number.isInteger(size)) fail();
  return size;
}

async function textItem(style, piece, fonts, baseSize) {
  const size = sizeOf(style, baseSize);
  const font = await fonts.get(style, size);
  for (const character of piece) {
    if (character !== "\t" && character !== "\n" && !font.characters.has(character.codePointAt(0))) {
      fail(`“${font.family}” yazı tipinde belgedeki bazı karakterler bulunamadı.`);
    }
  }
  const { measure } = font;
  return {
    kind: "text", piece, font, size,
    width: piece === "\t" || piece === "\n" ? 0 : measure.width(piece),
    height: measure.height, ascent: measure.ascent, gap: measure.gap, align: measure.align, measure,
    color: color(style.foreground), underline: flag(style, "underline"),
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
  return { tokens, end };
}

// Places the items of one row: text starts trunc((H - h) * align) below the top,
// an image sits on the row bottom, and an image row is taller by the text gap.
function finishRow(line, spacing) {
  const texts = line.items.filter(item => item.kind === "text");
  const gap = texts.length ? Math.max(...texts.map(item => item.gap)) : 0;
  let height = 0;
  for (const item of line.items) height = Math.max(height, item.kind === "image" ? item.height + gap : item.height);
  const padding = Math.floor(height * spacing / 2);
  for (const item of line.items) {
    item.top = padding + (item.kind === "image" ? height - item.height : Math.trunc((height - item.height) * item.align));
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
  if (left < 0 || right < 0 || left + firstIndent < 0) fail("Bu UDF negatif girinti içeriyor. Bu girinti henüz birebir dönüştürülemiyor.");
  const spacing = number(settings.LineSpacing, 0, 0, 10);
  const above = Math.trunc(number(settings.SpaceAbove, 0, 0, 2000));
  const below = Math.trunc(number(settings.SpaceBelow, 0, 0, 2000));
  const baseSize = sizeOf(settings, 12);
  const { tokens, end } = await paragraphTokens(block, fonts, baseSize);

  const lines = [];
  let line;
  function startLine() {
    const indent = left + (lines.length ? 0 : firstIndent);
    line = { items: [], used: 0, indent, available: width - indent - right };
    lines.push(line);
  }
  function add(item, advance = item.width) {
    line.items.push({ ...item, advance, x: line.used });
    line.used += advance;
  }
  startLine();
  for (const [tokenIndex, token] of tokens.entries()) {
    if (token.type === "tab") {
      if (align !== 0) fail("Bu UDF ortalanmış veya yaslanmış satırda sekme içeriyor. Bu düzen henüz birebir dönüştürülemiyor.");
      const position = line.indent - left + line.used;
      const advance = (Math.floor(position / defaultTab) + 1) * defaultTab - position;
      if (line.used + advance > line.available) fail();
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
    const used = items.slice(0, last).reduce((total, item) => total + item.advance, 0)
      + ending.filter(item => item.piece === "\n").reduce((total, item) => total + item.width, 0);
    const free = current.available - Math.trunc(used);
    let extra = 0;
    if (align === 3 && index < lines.length - 1 && free > 0) {
      const count = items.slice(0, last).filter(item => item.kind === "text" && item.piece.startsWith(" "))
        .reduce((total, item) => total + item.piece.length, 0);
      // UYAP spreads the unrounded free width, trailing spaces included, over the inner spaces.
      const trailing = ending.filter(item => item.piece !== "\n").reduce((total, item) => total + item.advance, 0);
      if (count) extra = (current.available - used - trailing) / count;
      current.x = current.indent;
    } else {
      current.x = current.indent + Math.trunc(free * (align === 1 ? 0.5 : align === 2 ? 1 : 0));
    }
    let spaces = 0;
    for (const item of items) {
      item.x = Math.round(item.x) + spaces * extra;
      if (item.kind === "text" && item.piece.startsWith(" ")) spaces += item.piece.length;
    }
    finishRow(current, spacing);
  }
  return { above, below, lines };
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
  const geometry = pageGeometry(model.margins);
  const a4Height = a4[1];

  function placeLine(line, x0, top, target) {
    for (const item of line.items) {
      const x = x0 + line.x + item.x;
      if (item.kind === "image") {
        target.push({ type: "image", image: item.image, x, y: top - item.top - item.height, width: item.width, height: item.height });
        continue;
      }
      if (item.piece === "\n" || item.piece === "\t") continue;
      const baseline = top - item.top - item.ascent;
      target.push({ type: "text", text: item.piece, font: item.font, size: item.size, color: item.color, x, y: baseline });
      if (item.underline) {
        // Swing draws the underline over the truncated width, one point below the item box.
        target.push({ type: "line", x0: x, x1: x + Math.trunc(item.width), y: top - item.top - item.height - 1, color: item.color });
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
          draw: (target, top) => placeLine(line, geometry.originX, top, target),
        }));
        continue;
      }
      const widths = columnWidths(block.spans, geometry.contentWidth);
      for (const row of block.rows) {
        const cells = [];
        let rowHeight = 0;
        for (const [index, cell] of row.cells.entries()) {
          const content = await layoutBlocks(cell.blocks, widths[index]);
          cells.push(content);
          rowHeight = Math.max(rowHeight, content.height);
        }
        rows.push({
          above: 0, below: 0, first: true, height: rowHeight, table: true,
          draw(target, top) {
            let x = geometry.originX;
            for (const [index, content] of cells.entries()) {
              let cellTop = top;
              for (const paragraph of content.laid) {
                cellTop -= paragraph.above;
                for (const line of paragraph.lines) {
                  placeLine(line, x, cellTop, target);
                  cellTop -= line.height;
                }
                cellTop -= paragraph.below;
              }
              if (block.border === "borderCell") target.push({ type: "rect", x, y: top - rowHeight, width: widths[index], height: rowHeight });
              x += widths[index];
            }
          },
        });
      }
    }
    return rows;
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
  const footerBottom = geometry.pageSize[1] - Math.floor(a4Height - model.margins.footer) + 1;
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
  for (const row of await flow(model.blocks)) {
    if (row.pageBreak) {
      newPage();
      continue;
    }
    y -= row.above;
    if (!fits(row.height)) {
      newPage();
      if (row.first) y -= row.above;
      if (!fits(row.height)) fail(row.table ? "Bu UDF sayfaya sığmayan bir tablo satırı içeriyor. Bu düzen henüz birebir dönüştürülemiyor." : "Bu UDF sayfaya sığmayan bir satır içeriyor.");
    }
    row.draw(page.items, y);
    y -= row.height + row.below;
  }
  return { pageSize: geometry.pageSize, pages };
}
