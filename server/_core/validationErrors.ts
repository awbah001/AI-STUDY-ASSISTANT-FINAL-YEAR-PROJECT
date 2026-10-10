import type { ZodError } from "zod";

type Issue = ZodError["issues"][number];

function fieldLabel(path: PropertyKey[]): string {
  const key = [...path].reverse().find((part): part is string => typeof part === "string");
  if (!key) return "This field";
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Zod's built-in messages ("Too small: expected string to have >=1 characters") are not for end users. */
function isDefaultMessage(message: string) {
  return /^(Too small|Too big|Invalid (input|string|option|email|url|number)|Expected|Required)/i.test(message);
}

function describeIssue(issue: Issue): string {
  if (!isDefaultMessage(issue.message)) return issue.message;
  const label = fieldLabel(issue.path);
  const detail = issue as Issue & { origin?: string; minimum?: number | bigint; maximum?: number | bigint; format?: string };
  switch (issue.code) {
    case "too_small":
      if (detail.origin === "string") {
        return Number(detail.minimum) <= 1 ? `${label} is required.` : `${label} must be at least ${detail.minimum} characters.`;
      }
      if (detail.origin === "array") return `Add at least ${detail.minimum} item(s) to ${label.toLowerCase()}.`;
      return `${label} must be at least ${detail.minimum}.`;
    case "too_big":
      if (detail.origin === "string") return `${label} must be at most ${detail.maximum} characters.`;
      if (detail.origin === "array") return `${label} can have at most ${detail.maximum} item(s).`;
      return `${label} must be at most ${detail.maximum}.`;
    case "invalid_format":
      return detail.format === "email" ? "Enter a valid email address." : `${label} is not in a valid format.`;
    case "invalid_type":
      return `${label} is required.`;
    default:
      return `${label} is not valid.`;
  }
}

export function describeZodError(error: ZodError): { message: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = describeIssue(issue);
  }
  const first = error.issues[0];
  return { message: first ? describeIssue(first) : "Some fields are not valid.", fieldErrors };
}
