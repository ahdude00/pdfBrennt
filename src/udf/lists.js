// List markers as UYAP Editör's paragraph view (editor.common.text.ga) draws them.

// Utils.c: the 29 letters of the Turkish alphabet, repeated after z (aa, bb, …).
const lower = [..."zabcçdefgğhıijklmnoöprsştuüvy"];

function letters(value, upper) {
  const rest = value % 29;
  const rounds = Math.trunc(value / 29);
  const letter = lower[rest];
  const text = letter.repeat(rounds === 0 ? 1 : rest === 0 ? rounds : rounds + 1);
  return upper ? text.toLocaleUpperCase("tr") : text;
}

// iText's RomanNumberFactory.getString, upper-cased for the big styles.
function roman(value, upper) {
  let result = "";
  if (value < 0) {
    result = "-";
    value = -value;
  }
  if (value > 3000) {
    result += `|${roman(Math.trunc(value / 1000), false)}|`;
    value -= Math.trunc(value / 1000) * 1000;
  }
  for (const [amount, digits] of [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]) {
    while (value >= amount) {
      result += digits;
      value -= amount;
    }
  }
  return upper ? result.toUpperCase() : result;
}

const counters = {
  NUMBER: value => String(value),
  CHAR_SMALL: value => letters(value, false),
  CHAR_BIG: value => letters(value, true),
  ROMAN_SMALL: value => roman(value, false),
  ROMAN_BIG: value => roman(value, true),
};
const wrappers = { DOT: text => `${text}.`, TRE: text => `${text}-`, PARANTHESE: text => `${text})`, D_PARANTHESE: text => `(${text})` };
const simple = /^NUMBER_TYPE_(NUMBER|CHAR_SMALL|CHAR_BIG|ROMAN_SMALL|ROMAN_BIG)_(DOT|TRE|PARANTHESE|D_PARANTHESE)$/u;

// The label of one number. Unknown types fall back to "n.".
export function numberLabel(type, value) {
  const match = simple.exec(type);
  return match ? wrappers[match[2]](counters[match[1]](value)) : `${value}.`;
}

// The style a level uses: a plain style keeps its first level and then follows
// a., i., (1), (a), (i); the numbered "_2" styles and the bullet styles have
// sequences of their own. Null means UYAP draws nothing.
const numberLevels = {
  simple: [null, "NUMBER_TYPE_CHAR_SMALL_DOT", "NUMBER_TYPE_ROMAN_SMALL_DOT", "NUMBER_TYPE_NUMBER_D_PARANTHESE", "NUMBER_TYPE_CHAR_SMALL_D_PARANTHESE", "NUMBER_TYPE_ROMAN_SMALL_D_PARANTHESE"],
  NUMBER_TYPE_NUMBER_DOT_2: ["NUMBER_TYPE_NUMBER_DOT", "NUMBER_TYPE_CHAR_SMALL_DOT", "NUMBER_TYPE_NUMBER_PARANTHESE", "NUMBER_TYPE_CHAR_SMALL_PARANTHESE", "NUMBER_TYPE_NUMBER_D_PARANTHESE", "NUMBER_TYPE_CHAR_SMALL_D_PARANTHESE"],
  NUMBER_TYPE_NUMBER_PARANTHESE_2: ["NUMBER_TYPE_NUMBER_PARANTHESE", "NUMBER_TYPE_CHAR_SMALL_PARANTHESE", "NUMBER_TYPE_ROMAN_SMALL_PARANTHESE", "NUMBER_TYPE_NUMBER_DOT", "NUMBER_TYPE_CHAR_SMALL_DOT", "NUMBER_TYPE_ROMAN_SMALL_DOT"],
  NUMBER_TYPE_CHAR_BIG_2: ["NUMBER_TYPE_CHAR_BIG_DOT", "NUMBER_TYPE_NUMBER_DOT", "NUMBER_TYPE_CHAR_SMALL_PARANTHESE", "NUMBER_TYPE_NUMBER_PARANTHESE", "NUMBER_TYPE_CHAR_SMALL_D_PARANTHESE", "NUMBER_TYPE_ROMAN_SMALL_D_PARANTHESE"],
};
const bulletBase = ["BULLET_TYPE_ELLIPSE", "BULLET_TYPE_RECTANGLE_D", "BULLET_TYPE_RECTANGLE", "BULLET_TYPE_ARROW", "BULLET_TYPE_DIAMOND", "BULLET_TYPE_TRIANGLE"];
const bulletLevels = {
  base: [null, "BULLET_TYPE_RECTANGLE", "BULLET_TYPE_RECTANGLE_D", "BULLET_TYPE_DIAMOND", "BULLET_TYPE_ARROW", "BULLET_TYPE_TRIANGLE"],
  BULLET_TYPE_DIAMOND_2: ["BULLET_TYPE_DIAMOND", "BULLET_TYPE_RECTANGLE", "BULLET_TYPE_ELLIPSE", "BULLET_TYPE_RECTANGLE_D", "BULLET_TYPE_ARROW", "BULLET_TYPE_TRIANGLE"],
};

// What a list paragraph shows: { kind: "bullet", type } or { kind: "number", type }
// or { kind: "outline" } for NUMBER_DOT_3, or null.
export function markerKind(list) {
  const { level } = list;
  if (level < 1) return null;
  // The outline style is drawn at any depth; every other style only on levels 1–6.
  if (list.numbered && list.sec == null && list.numberType === "NUMBER_TYPE_NUMBER_DOT_3") return { kind: "outline" };
  if (level > 6) return null;
  if (list.sec != null) return list.sec.startsWith("BULLET_TYPE") ? { kind: "bullet", type: list.sec } : { kind: "number", type: list.sec, lineIndent: true };
  if (list.bulleted) {
    const type = list.bulletType ?? "BULLET_TYPE_ELLIPSE";
    if (bulletBase.includes(type)) return { kind: "bullet", type: bulletLevels.base[level - 1] ?? type };
    if (bulletLevels[type]) return { kind: "bullet", type: bulletLevels[type][level - 1] };
    return null;
  }
  if (list.numbered) {
    const type = list.numberType ?? "NUMBER_TYPE_NUMBER_DOT";
    if (simple.test(type)) return { kind: "number", type: numberLevels.simple[level - 1] ?? type, lineIndent: true };
    if (numberLevels[type]) return { kind: "number", type: numberLevels[type][level - 1], lineIndent: true };
    if (type === "NUMBER_TYPE_NUMBER_DOT_3") return { kind: "outline" };
  }
  return null;
}

// Counter of a paragraph among the paragraphs of its list (document order): count
// back over the same level until a shallower one; a set start number ends the count.
export function listNumber(members, index) {
  const own = members[index];
  let count = 0;
  for (let at = index; at >= 0; at--) {
    const other = members[at];
    if (other.level < own.level) return count;
    if (other.level === own.level) {
      if (other.start >= 0) return count + other.start + 1;
      count++;
    }
  }
  return count;
}

// NUMBER_DOT_3: "1.2.3." with the counters of every level up to this one.
export function outlineLabel(members, index) {
  const own = members[index];
  const counts = new Array(own.level).fill(0);
  const done = new Set();
  let current = own.level;
  for (let at = index; at >= 0; at--) {
    const { level, start } = members[at];
    if (done.has(level)) continue;
    if (level < current) {
      counts[level - 1]++;
      current = level;
      if (start >= 0) {
        counts[level - 1] += start;
        done.add(level);
      }
    } else if (level === current) {
      counts[current - 1]++;
      if (start >= 0) {
        counts[current - 1] += start;
        done.add(current);
      }
    }
  }
  return counts.map(value => `${value || 1}.`).join("");
}

// The bullet shapes, in Java coordinates relative to the bullet's top-left corner,
// with s the font size divided by three. All are filled black; the raised square
// (draw3DRect) is four one-point bars, its top-left ones in black.brighter().
export function bulletShapes(type, s) {
  const size = s + 1;
  // editor.utils.f scales the size by 1.2 for both directions of the arrow and diamond.
  const scaled = size * 1.2;
  const width = scaled;
  const height = scaled;
  switch (type) {
    case "BULLET_TYPE_ELLIPSE": return [{ ellipse: [0, 0, size, size] }];
    case "BULLET_TYPE_RECTANGLE": return [{ polygon: [[0, 0], [s, 0], [s, s], [0, s]] }];
    case "BULLET_TYPE_RECTANGLE_D": return [
      { polygon: [[0, 0], [1, 0], [1, s + 1], [0, s + 1]], color: [3, 3, 3] },
      { polygon: [[1, 0], [s, 0], [s, 1], [1, 1]], color: [3, 3, 3] },
      { polygon: [[1, s], [s + 1, s], [s + 1, s + 1], [1, s + 1]] },
      { polygon: [[s, 0], [s + 1, 0], [s + 1, s], [s, s]] },
    ];
    case "BULLET_TYPE_ARROW": return [{ polygon: [[0, 0], [width / 4, height / 2], [0, height], [width, height / 2]] }];
    case "BULLET_TYPE_DIAMOND": return [{ polygon: [[width / 2, 0], [0, height / 2], [width / 2, height], [width, height / 2]] }];
    case "BULLET_TYPE_TRIANGLE": {
      const even = size % 2 ? size + 1 : size;
      return [{ polygon: [[0, 0], [0, even], [even, Math.trunc(even / 2)]] }];
    }
    default: return [];
  }
}
