import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MESSAGES,
  parseRubricText,
  titleFromFileName,
  validateCourseCode,
  validateFutureDate,
  validateEmail,
  validateNewPassword,
  validateNumber,
  validatePersonName,
  validatePhone,
  validateText,
  validateTotpCode,
  zEmail,
  zNewPassword,
  zPersonName,
  zText,
} from "../shared/validation";
import { describeZodError } from "./_core/validationErrors";
import { DEFAULT_SYSTEM_SETTINGS, findSystemSettingsError } from "../shared/adminSettings";

describe("course and assignment helpers", () => {
  it("checks course codes the same way the enroll endpoint does", () => {
    expect(validateCourseCode("ab12")).toBeNull();
    expect(validateCourseCode("")).toBe("Course code is required.");
    expect(validateCourseCode("AB")).toMatch(/4–10 character/);
    expect(validateCourseCode("AB 12")).toMatch(/4–10 character/);
  });

  it("only accepts deadlines in the future", () => {
    expect(validateFutureDate("", { label: "Due date" })).toBeNull();
    expect(validateFutureDate("", { label: "Due date", required: true })).toBe("Due date is required.");
    expect(validateFutureDate("2000-01-01T10:00", { label: "Due date" })).toBe("Due date must be in the future.");
    expect(validateFutureDate("not a date", { label: "Due date" })).toBe("Due date is not a valid date.");
    expect(validateFutureDate(new Date(Date.now() + 60_000), { label: "Due date" })).toBeNull();
  });

  it("parses rubric text and explains bad entries", () => {
    expect(parseRubricText("")).toEqual({ rubric: undefined, error: null });
    expect(parseRubricText("Research: 30, Analysis: 40")).toEqual({
      rubric: [{ criterion: "Research", maxPoints: 30 }, { criterion: "Analysis", maxPoints: 40 }],
      error: null,
    });
    expect(parseRubricText("Research 30").error).toBe('"Research 30" should look like "Research: 30".');
    expect(parseRubricText("Research: 0").error).toMatch(/between 1 and 1000/);
    expect(parseRubricText("A: 1, a: 2").error).toMatch(/different name/);
  });

  it("builds a valid fallback title from a file name", () => {
    expect(titleFromFileName("Week_3_notes.pdf")).toBe("Week 3 notes");
    expect(titleFromFileName("a.pdf")).toBe("a.pdf");
    expect(titleFromFileName(`${"x".repeat(400)}.pdf`)).toHaveLength(200);
  });
});

describe("system settings checks", () => {
  it("accepts the defaults and names the field that is out of range", () => {
    expect(findSystemSettingsError(DEFAULT_SYSTEM_SETTINGS)).toBeNull();
    const bad = structuredClone(DEFAULT_SYSTEM_SETTINGS);
    bad.academic.passMark = 150;
    expect(findSystemSettingsError(bad)).toBe("Pass mark must be between 0 and 100.");
    const overlap = structuredClone(DEFAULT_SYSTEM_SETTINGS);
    overlap.ai.rag.chunkOverlap = 1500;
    expect(findSystemSettingsError(overlap)).toBe("Chunk overlap must be smaller than the chunk size.");
    const color = structuredClone(DEFAULT_SYSTEM_SETTINGS);
    color.appearance.primaryColor = "green";
    expect(findSystemSettingsError(color)).toMatch(/hex color/);
  });
});

describe("shared form validators", () => {
  it("rejects blank and whitespace-only required text", () => {
    expect(validateText("   ", { label: "Title", max: 200 })).toBe("Title is required.");
    expect(validateText("a", { label: "Title", min: 2, max: 200 })).toBe("Title must be at least 2 characters.");
    expect(validateText("x".repeat(201), { label: "Title", max: 200 })).toBe("Title must be at most 200 characters.");
    expect(validateText("", { label: "Notes", required: false, max: 50 })).toBeNull();
    expect(validateText("  Week 1  ", { label: "Title", max: 200 })).toBeNull();
  });

  it("checks email format and the school domain", () => {
    expect(validateEmail("")).toBe(MESSAGES.emailRequired);
    expect(validateEmail("maya@")).toBe(MESSAGES.emailInvalid);
    expect(validateEmail("maya@central")).toBe(MESSAGES.emailInvalid);
    expect(validateEmail("maya@gmail.com")).toMatch(/central\.edu\.sl/);
    expect(validateEmail(" Maya@Central.edu.sl ")).toBeNull();
    expect(validateEmail("maya@gmail.com", { requireSchoolDomain: false })).toBeNull();
  });

  it("requires a reasonably strong new password", () => {
    expect(validateNewPassword("")).toBe(MESSAGES.passwordRequired);
    expect(validateNewPassword("abc1")).toBe(MESSAGES.passwordShort);
    expect(validateNewPassword("abcdefgh")).toBe(MESSAGES.passwordWeak);
    expect(validateNewPassword("12345678")).toBe(MESSAGES.passwordWeak);
    expect(validateNewPassword("study2026")).toBeNull();
  });

  it("validates names, phones, codes and numbers", () => {
    expect(validatePersonName("M")).toMatch(/at least 2/);
    expect(validatePersonName("Maya123")).toBe(MESSAGES.nameInvalid);
    expect(validatePersonName("Aminata O'Neil-Kamara")).toBeNull();
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("12ab")).toBe(MESSAGES.phoneInvalid);
    expect(validatePhone("+232 76 123 456")).toBeNull();
    expect(validateTotpCode("12345")).toBe(MESSAGES.codeInvalid);
    expect(validateTotpCode("123 456")).toBeNull();
    expect(validateNumber("abc", { label: "Points" })).toBe("Points must be a number.");
    expect(validateNumber("101", { label: "Points", max: 100 })).toBe("Points must be at most 100.");
  });
});

describe("shared zod schemas", () => {
  it("trims, normalises and rejects with the same messages", () => {
    expect(zText("Title", { max: 10 }).safeParse("   ").error?.issues[0]?.message).toBe("Title is required.");
    expect(zText("Title", { max: 10 }).parse("  Week 1 ")).toBe("Week 1");
    expect(zEmail.parse(" Maya@Central.edu.sl ")).toBe("maya@central.edu.sl");
    expect(zNewPassword.safeParse("password").error?.issues[0]?.message).toBe(MESSAGES.passwordWeak);
    expect(zPersonName().parse("  Maya   Chen ")).toBe("Maya Chen");
  });
});

describe("describeZodError", () => {
  it("turns zod's default messages into sentences with the field name", () => {
    const schema = z.object({ courseTitle: z.string().min(1), notes: z.string().max(3), email: z.email() });
    const result = schema.safeParse({ courseTitle: "", notes: "long", email: "x" });
    const { message, fieldErrors } = describeZodError(result.error!);
    expect(message).toBe("Course title is required.");
    expect(fieldErrors.notes).toBe("Notes must be at most 3 characters.");
    expect(fieldErrors.email).toBe("Enter a valid email address.");
  });

  it("keeps custom messages untouched", () => {
    const result = z.object({ title: zText("Title", { max: 5 }) }).safeParse({ title: "toolong" });
    expect(describeZodError(result.error!).message).toBe("Title must be at most 5 characters.");
  });
});
