import { fileTypeProblem, fitWithin } from "@/lib/upload/client";

describe("browser upload helpers", () => {
  it("accepts JPEG, PNG and WebP", () => {
    for (const [name, type] of [["a.jpg", "image/jpeg"], ["b.png", "image/png"], ["c.webp", "image/webp"], ["d.JPEG", ""]]) {
      expect(fileTypeProblem({ name: name!, type: type! })).toBeNull();
    }
  });
  it("refuses HEIC with iPhone-specific help, and other types generally", () => {
    expect(fileTypeProblem({ name: "IMG_1.HEIC", type: "" })).toMatch(/iPhone HEIC/);
    expect(fileTypeProblem({ name: "x.heif", type: "image/heif" })).toMatch(/iPhone HEIC/);
    expect(fileTypeProblem({ name: "x.gif", type: "image/gif" })).toMatch(/JPEG, PNG or WebP/);
    expect(fileTypeProblem({ name: "x.pdf", type: "application/pdf" })).toMatch(/JPEG, PNG or WebP/);
  });
  it("fits the longest edge within 2800 px without upscaling", () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 2800, height: 1867 });
    expect(fitWithin(3000, 5600)).toEqual({ width: 1500, height: 2800 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});
