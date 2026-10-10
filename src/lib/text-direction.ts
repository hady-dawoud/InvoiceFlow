const letterPattern = /\p{L}/u;
const rtlScriptPattern =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

export function textDirection(value: string): "ltr" | "rtl" {
  for (const character of value) {
    if (letterPattern.test(character)) {
      return rtlScriptPattern.test(character) ? "rtl" : "ltr";
    }
  }

  return "ltr";
}
