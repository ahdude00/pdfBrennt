// List markers as UYAP Editör draws them. Positions were measured for sizes 6–40
// (tools/udf); they do not depend on the font family.
import { fail } from "./document.js";

// Distance from the row top to the marker baseline, indexed by size - 6.
const numberBaseline = [6, 7, 8, 8, 10, 10, 11, 11, 13, 14, 14, 15, 16, 17, 17, 18, 20, 20, 21, 21, 23, 24, 24, 25, 26, 27, 27, 28, 30, 30, 31, 31, 33, 33, 34];
// Filled circle bullet: [distance from the row top to the circle top, diameter].
const bulletBox = [[3, 3], [null, 3], [5, 3], [5, 4], [6, 4], [6, 4], [6, 5], [6, 5], [7, 5], [8, 6], [8, 6], [9, 6], [8, 7], [9, 7], [9, 7], [10, 8], [11, 8], [11, 8], [11, 9], [11, 9], [12, 9], [13, 10], [13, 10], [14, 10], [13, 11], [14, 11], [14, 11], [15, 12], [16, 12], [16, 12], [16, 13], [16, 13], [17, 13], [17, 14], [18, 14]];

const lower = [..."abcçdefgğhıijklmnoöprsştuüvyz"];
const upper = [..."ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"];

function roman(value) {
  const parts = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  for (const [amount, letters] of parts) while (value >= amount) { result += letters; value -= amount; }
  return result;
}

const formats = { DOT: value => `${value}.`, PARANTHESE: value => `${value})`, D_PARANTHESE: value => `(${value})`, TRE: value => `${value}-` };
const counters = {
  NUMBER: value => String(value),
  CHAR_SMALL: value => lower[value - 1] ?? fail("Bu UDF 29’dan uzun harfli bir liste içeriyor. Bu liste henüz birebir dönüştürülemiyor."),
  CHAR_BIG: value => upper[value - 1] ?? fail("Bu UDF 29’dan uzun harfli bir liste içeriyor. Bu liste henüz birebir dönüştürülemiyor."),
  ROMAN_SMALL: value => roman(value).toLowerCase(),
  ROMAN_BIG: value => roman(value),
};
const aliases = { NUMBER_TYPE_NUMBER_DOT_2: "NUMBER_TYPE_NUMBER_DOT", NUMBER_TYPE_CHAR_BIG_2: "NUMBER_TYPE_CHAR_BIG_DOT" };

export function numberLabel(type, value) {
  const match = /^NUMBER_TYPE_(NUMBER|CHAR_SMALL|CHAR_BIG|ROMAN_SMALL|ROMAN_BIG)_(DOT|PARANTHESE|D_PARANTHESE|TRE)$/u.exec(aliases[type] ?? type);
  if (!match) fail("Bu UDF desteklenmeyen bir numaralandırma türü içeriyor. Bu liste henüz birebir dönüştürülemiyor.");
  return formats[match[2]](counters[match[1]](value));
}

export function markerBaseline(size) {
  const value = numberBaseline[size - 6];
  if (value == null) fail("Bu UDF 6–40 punto dışında numaralı liste içeriyor. Bu liste henüz birebir dönüştürülemiyor.");
  return value;
}

export function bulletGeometry(size) {
  const box = bulletBox[size - 6];
  if (!box || box[0] == null) fail("Bu UDF bu puntoda madde işaretli liste içeriyor. Bu liste henüz birebir dönüştürülemiyor.");
  return { top: box[0], diameter: box[1] };
}
