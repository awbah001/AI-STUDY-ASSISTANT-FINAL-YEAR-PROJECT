import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { hasErrors, LIMITS, validateText, type FieldError, type FieldErrors } from "@shared/validation";

/** Admin actions record a short written reason in the audit log. Returns null when cancelled or invalid. */
export function promptReason(question: string): string | null {
  const reason = window.prompt(question);
  if (reason === null) return null;
  const error = validateText(reason, { label: "Reason", min: LIMITS.reason.min, max: LIMITS.reason.max });
  if (error) {
    toast.error(error);
    return null;
  }
  return reason.trim();
}

/** Wrap a shared validator so react-hook-form + zodResolver shows the same message. */
export function fromValidator(validate: (value: string) => FieldError) {
  return z.string().superRefine((value, ctx) => {
    const message = validate(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });
}

/**
 * Field errors for forms kept in plain useState: run `check` on submit,
 * call `clear(field)` from onChange so the message disappears while typing.
 */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({});

  const check = useCallback((next: FieldErrors<K>) => {
    setErrors(next);
    return !hasErrors(next);
  }, []);

  const clear = useCallback((field: K) => {
    setErrors(current => (current[field] ? { ...current, [field]: null } : current));
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  return { errors, check, clear, reset };
}
