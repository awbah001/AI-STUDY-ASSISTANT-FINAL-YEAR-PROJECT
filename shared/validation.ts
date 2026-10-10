import { z } from "zod";
import { EMAIL_DOMAIN_ERROR, isAllowedEmail } from "./emailDomain";

/**
 * Field rules shared by the server (zod schemas) and the web/mobile forms
 * (plain validators), so a value the form accepts is never rejected by the API
 * with a different message.
 */
export const LIMITS = {
  name: { min: 2, max: 100 },
  email: 254,
  password: { min: 8, max: 128 },
  title: { min: 2, max: 200 },
  shortText: 120,
  description: 2000,
  longText: 5000,
  chatMessage: 4000,
  search: 200,
  reason: { min: 3, max: 500 },
  phone: { minDigits: 7, maxDigits: 15 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
// Latin letters incl. accents, plus the separators used in real names.
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]*$/;
const PHONE_RE = /^\+?[0-9\s().-]+$/;

export type FieldError = string | null;
export type FieldErrors<K extends string = string> = Partial<Record<K, FieldError>>;

export const MESSAGES = {
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter a valid email address, like name@central.edu.sl.",
  passwordRequired: "Enter your password.",
  passwordShort: `Password must be at least ${LIMITS.password.min} characters.`,
  passwordLong: `Password must be at most ${LIMITS.password.max} characters.`,
  passwordWeak: "Password must include at least one letter and one number.",
  passwordMismatch: "Passwords do not match.",
  nameInvalid: "Name can only contain letters, spaces, hyphens, apostrophes and full stops.",
  phoneInvalid: "Enter a valid phone number, like +232 76 123 456.",
  codeInvalid: "Enter the 6-digit code from your authenticator app.",
} as const;

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function requiredMessage(label: string) {
  return `${label} is required.`;
}

export function tooShortMessage(label: string, min: number) {
  return `${label} must be at least ${min} characters.`;
}

export function tooLongMessage(label: string, max: number) {
  return `${label} must be at most ${max} characters.`;
}

/* ------------------------------------------------------------------ */
/* Plain validators for forms: return a message, or null when valid.   */
/* ------------------------------------------------------------------ */

export function validateText(
  value: string | null | undefined,
  opts: { label: string; required?: boolean; min?: number; max: number }
): FieldError {
  const text = clean(value);
  const required = opts.required ?? true;
  if (!text) return required ? requiredMessage(opts.label) : null;
  if (opts.min && text.length < opts.min) return tooShortMessage(opts.label, opts.min);
  if (text.length > opts.max) return tooLongMessage(opts.label, opts.max);
  return null;
}

export function validateEmail(
  value: string | null | undefined,
  opts: { requireSchoolDomain?: boolean; required?: boolean } = {}
): FieldError {
  const email = clean(value);
  if (!email) return opts.required === false ? null : MESSAGES.emailRequired;
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) return MESSAGES.emailInvalid;
  if ((opts.requireSchoolDomain ?? true) && !isAllowedEmail(email)) return EMAIL_DOMAIN_ERROR;
  return null;
}

/** For signing in: only checks that something was typed. */
export function validateLoginPassword(value: string | null | undefined): FieldError {
  return value ? null : MESSAGES.passwordRequired;
}

/** For choosing a new password. */
export function validateNewPassword(value: string | null | undefined): FieldError {
  const password = value ?? "";
  if (!password) return MESSAGES.passwordRequired;
  if (password.length < LIMITS.password.min) return MESSAGES.passwordShort;
  if (password.length > LIMITS.password.max) return MESSAGES.passwordLong;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return MESSAGES.passwordWeak;
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): FieldError {
  if (!confirm) return "Confirm your new password.";
  return password === confirm ? null : MESSAGES.passwordMismatch;
}

export function validatePersonName(value: string | null | undefined, label = "Name"): FieldError {
  const name = clean(value).replace(/\s+/g, " ");
  if (!name) return requiredMessage(label);
  if (name.length < LIMITS.name.min) return tooShortMessage(label, LIMITS.name.min);
  if (name.length > LIMITS.name.max) return tooLongMessage(label, LIMITS.name.max);
  if (!NAME_RE.test(name)) return MESSAGES.nameInvalid;
  return null;
}

export function validatePhone(value: string | null | undefined, opts: { required?: boolean } = {}): FieldError {
  const phone = clean(value);
  if (!phone) return opts.required ? requiredMessage("Phone number") : null;
  const digits = phone.replace(/\D/g, "").length;
  if (!PHONE_RE.test(phone) || digits < LIMITS.phone.minDigits || digits > LIMITS.phone.maxDigits) {
    return MESSAGES.phoneInvalid;
  }
  return null;
}

/** Authenticator code (6 digits) or a longer recovery code. */
export function validateTotpCode(value: string | null | undefined): FieldError {
  const code = clean(value).replace(/\s+/g, "");
  if (/^\d{6}$/.test(code)) return null;
  return code.length >= 8 && code.length <= 64 ? null : MESSAGES.codeInvalid;
}

export function validateNumber(
  value: string | number | null | undefined,
  opts: { label: string; min?: number; max?: number; integer?: boolean; required?: boolean }
): FieldError {
  const raw = typeof value === "number" ? String(value) : clean(value);
  if (!raw) return opts.required === false ? null : requiredMessage(opts.label);
  const num = Number(raw);
  if (!Number.isFinite(num)) return `${opts.label} must be a number.`;
  if (opts.integer && !Number.isInteger(num)) return `${opts.label} must be a whole number.`;
  if (opts.min !== undefined && num < opts.min) return `${opts.label} must be at least ${opts.min}.`;
  if (opts.max !== undefined && num > opts.max) return `${opts.label} must be at most ${opts.max}.`;
  return null;
}

/** Fallback document title when the user leaves it blank; fits the server's title limits. */
export function titleFromFileName(fileName: string): string {
  const base = clean(fileName).replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const title = (base.length >= LIMITS.title.min ? base : clean(fileName)).slice(0, LIMITS.title.max).trim();
  return title.length >= LIMITS.title.min ? title : "Study material";
}

export const COURSE_CODE_PATTERN = /^[A-Z0-9-]{4,10}$/;
export const COURSE_CODE_MESSAGE = "Enter the 4–10 character course code from your lecturer.";

export function validateCourseCode(value: string | null | undefined): FieldError {
  const code = clean(value).toUpperCase();
  if (!code) return requiredMessage("Course code");
  return COURSE_CODE_PATTERN.test(code) ? null : COURSE_CODE_MESSAGE;
}

/** Deadlines: empty is allowed unless required; otherwise must parse and be in the future. */
export function validateFutureDate(
  value: string | Date | null | undefined,
  opts: { label: string; required?: boolean }
): FieldError {
  if (!value || (typeof value === "string" && !value.trim())) {
    return opts.required ? requiredMessage(opts.label) : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return `${opts.label} is not a valid date.`;
  if (date.getTime() <= Date.now()) return `${opts.label} must be in the future.`;
  return null;
}

export type RubricCriterion = { criterion: string; maxPoints: number };

/** Parses "Research: 30, Analysis: 40". Empty text means no rubric. */
export function parseRubricText(text: string): { rubric?: RubricCriterion[]; error: FieldError } {
  const trimmed = clean(text);
  if (!trimmed) return { rubric: undefined, error: null };
  const parts = trimmed.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length > 12) return { error: "A rubric can have at most 12 criteria." };
  const rubric: RubricCriterion[] = [];
  for (const part of parts) {
    const [rawName, rawPoints, ...rest] = part.split(":");
    const criterion = rawName?.trim() ?? "";
    const points = Number(rawPoints?.trim());
    if (!criterion || rest.length || !rawPoints?.trim() || !Number.isFinite(points)) {
      return { error: `"${part}" should look like "Research: 30".` };
    }
    if (criterion.length > LIMITS.shortText) return { error: `Criterion names must be ${LIMITS.shortText} characters or fewer.` };
    if (points <= 0 || points > 1000) return { error: `Points for "${criterion}" must be between 1 and 1000.` };
    rubric.push({ criterion, maxPoints: points });
  }
  const names = new Set(rubric.map(item => item.criterion.toLowerCase()));
  if (names.size !== rubric.length) return { error: "Each rubric criterion must have a different name." };
  return { rubric, error: null };
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function firstError(errors: FieldErrors): FieldError {
  return Object.values(errors).find(Boolean) ?? null;
}

/* ------------------------------------------------------------------ */
/* Zod builders for tRPC inputs: same rules, same messages.            */
/* ------------------------------------------------------------------ */

export function zText(label: string, opts: { min?: number; max: number }) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage(label))
    .min(opts.min ?? 1, tooShortMessage(label, opts.min ?? 1))
    .max(opts.max, tooLongMessage(label, opts.max));
}

export function zOptionalText(label: string, max: number) {
  return z.string().trim().max(max, tooLongMessage(label, max));
}

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, MESSAGES.emailRequired)
  .max(LIMITS.email, MESSAGES.emailInvalid)
  .regex(EMAIL_RE, MESSAGES.emailInvalid);

export const zNewPassword = z
  .string()
  .min(LIMITS.password.min, MESSAGES.passwordShort)
  .max(LIMITS.password.max, MESSAGES.passwordLong)
  .refine(value => /[A-Za-z]/.test(value) && /\d/.test(value), MESSAGES.passwordWeak);

export const zLoginPassword = z.string().min(1, MESSAGES.passwordRequired).max(LIMITS.password.max * 2);

export function zPersonName(label = "Name") {
  return z
    .string()
    .trim()
    .transform(value => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, requiredMessage(label))
        .min(LIMITS.name.min, tooShortMessage(label, LIMITS.name.min))
        .max(LIMITS.name.max, tooLongMessage(label, LIMITS.name.max))
        .regex(NAME_RE, MESSAGES.nameInvalid)
    );
}

export const zPhone = z
  .string()
  .trim()
  .max(30, MESSAGES.phoneInvalid)
  .refine(value => validatePhone(value) === null, MESSAGES.phoneInvalid);

export const zReason = zText("Reason", { min: LIMITS.reason.min, max: LIMITS.reason.max });
