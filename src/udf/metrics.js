// Text measurement that follows UYAP Editör (Java 8 Swing on Windows).
// Horizontal advances are unhinted, so they come straight from the font file.
// Line placement uses the Java runtime's integer ascent, descent and leading,
// recorded for Times New Roman and Arial in java-metrics.js.
import javaTable from "./java-metrics.js";

export function hasJavaMetrics(familyKey) {
  return Boolean(javaTable.fonts[familyKey]);
}

// Measuring functions for one font face at one size. `metrics` is the fontkit font
// of the file embedded in the PDF. `exact` is false for fonts without recorded
// Java metrics; their vertical placement is approximate.
export function measureFont({ metrics, familyKey, face, size, exact }) {
  const scale = size / metrics.unitsPerEm;
  const row = exact ? javaTable.fonts[familyKey]?.[face]?.[size - 1] : null;
  const advances = new Map();
  function advance(codePoint) {
    let value = advances.get(codePoint);
    if (value === undefined) {
      value = metrics.glyphForCodePoint(codePoint).advanceWidth * scale;
      advances.set(codePoint, value);
    }
    return value;
  }
  const floatHeight = (metrics.ascent - metrics.descent + metrics.lineGap) * scale;
  const [javaAscent, javaDescent, javaLeading] = row ?? [Math.round(metrics.ascent * scale), Math.round(-metrics.descent * scale), 0];
  // Measured against UYAP Editör exports (tools/udf/alignment.mjs):
  // a line is ceil(float height) tall, the baseline sits Java ascent + leading below
  // the top, and in a taller row the text starts trunc((rowHeight - height) * align).
  const height = Math.ceil(floatHeight);
  const gap = Math.max(0, javaDescent - 2);
  return {
    height,
    ascent: Math.min(height, javaAscent + javaLeading),
    javaAscent,
    javaDescent,
    gap,
    align: 1 - gap / (floatHeight + 1),
    // Unrounded advance of a text piece.
    width(text) {
      let total = 0;
      for (const character of text) total += advance(character.codePointAt(0));
      return total;
    },
  };
}
