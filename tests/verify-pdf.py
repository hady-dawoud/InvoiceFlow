from pathlib import Path
import fitz

paths = [Path("tmp/pdf-review") / f"{name}.pdf" for name in ["short", "thirty", "long", "large"]]
assert all(path.is_file() for path in paths), "Run npx tsx tests/pdf-review.ts first"
for path in paths:
    with fitz.open(path) as document:
        text = "".join(page.get_text() for page in document)
        for page in document:
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        left, top, right, bottom = span["bbox"]
                        assert left >= 49 and right <= 564 and top >= 0 and bottom < 770, (path, span)
        if path.stem == "short":
            assert len(document) == 1
        elif path.stem == "thirty":
            assert len(document) == 2
            assert all("DESCRIPTION" in page.get_text() for page in document)
        elif path.stem == "long":
            assert all(marker in text for marker in ["ADDRESS_END", "NOTES_END", "DESCRIPTION_END", "FINAL_ITEM"])
        elif path.stem == "large":
            assert "$90,071,992,547,409.91" in text
        for index, page in enumerate(document):
            page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(str(path.with_name(f"{path.stem}-{index + 1}.png")))
        print(f"{path.stem}: {len(document)} pages, text and bounds verified")
