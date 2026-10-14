import { describe, expect, it } from "vitest";
import { isCourseCoverUrl } from "./lecturerRouter";

describe("isCourseCoverUrl", () => {
  it("accepts images uploaded into the lecturer's own course folder", () => {
    expect(isCourseCoverUrl("/uploads/7/courses/3/1791-cover.jpg", 7)).toBe(true);
    expect(isCourseCoverUrl("/uploads/7/courses/3/1791-cover.WEBP", 7)).toBe(true);
  });

  it("accepts external https images", () => {
    expect(isCourseCoverUrl("https://cdn.example.com/cover.png?w=400", 7)).toBe(true);
  });

  it("rejects other lecturers' uploads, non-images and plain http", () => {
    expect(isCourseCoverUrl("/uploads/8/courses/3/cover.jpg", 7)).toBe(false);
    expect(isCourseCoverUrl("/uploads/7/courses/3/notes.pdf", 7)).toBe(false);
    expect(isCourseCoverUrl("http://example.com/cover.jpg", 7)).toBe(false);
    expect(isCourseCoverUrl("javascript:alert(1)//.png", 7)).toBe(false);
  });
});
