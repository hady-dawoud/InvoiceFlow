import { expect, it } from "vitest";
import { textDirection } from "./text-direction";

it("classifies stored text", () => {
  expect(textDirection("مكتب")).toBe("rtl");
  expect(textDirection("Acme")).toBe("ltr");
  expect(textDirection("2 كتب")).toBe("rtl");
  expect(textDirection("+20 100 123 4567")).toBe("ltr");
  expect(textDirection("-$50")).toBe("ltr");
  expect(textDirection("")).toBe("ltr");
  expect(textDirection("١٢٣")).toBe("ltr");
});
