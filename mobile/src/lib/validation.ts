import { useCallback, useState } from "react";
import {
  hasErrors,
  validateNewPassword,
  validatePasswordConfirm,
  type FieldErrors,
} from "../../../shared/validation";

export * from "../../../shared/validation";

export function passwordChangeErrors(current: string, next: string, confirm: string): FieldErrors<"current" | "next" | "confirm"> {
  return {
    current: current ? null : "Enter your current password.",
    next:
      validateNewPassword(next) ??
      (next === current ? "Choose a password that is different from your current one." : null),
    confirm: validatePasswordConfirm(next, confirm),
  };
}

/**
 * Field errors for screens kept in plain useState: run `check` on submit,
 * call `clear(field)` from onChangeText so the message disappears while typing.
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
