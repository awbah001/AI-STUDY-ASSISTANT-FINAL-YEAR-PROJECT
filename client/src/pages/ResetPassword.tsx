import { useState } from "react";
import { Link, useLocation } from "wouter";
import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { PasswordRules } from "@/components/PasswordRules";
import { trpc } from "@/lib/trpc";
import { useFieldErrors } from "@/lib/formValidation";
import { validateNewPassword, validatePasswordConfirm } from "@shared/validation";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverError, setServerError] = useState("");
  const { errors, check, clear } = useFieldErrors<"password" | "confirm">();
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => setLocation("/login"), onError: e => setServerError(e.message) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const ok = check({
      password: validateNewPassword(password),
      confirm: validatePasswordConfirm(password, confirm),
    });
    if (ok) reset.mutate({ token, newPassword: password });
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Use a strong password with at least 8 characters, including a letter and a number.">
      <form className="space-y-5" onSubmit={submit} noValidate>
        {!token ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This reset link is invalid or incomplete. Request a new one.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => { setPassword(e.target.value); clear("password"); }}
                aria-invalid={Boolean(errors.password)}
                className="h-12 rounded-2xl"
              />
              <PasswordRules value={password} />
              <FieldError message={errors.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); clear("confirm"); }}
                aria-invalid={Boolean(errors.confirm)}
                className="h-12 rounded-2xl"
              />
              <FieldError message={errors.confirm} />
            </div>
            <Button className="h-12 w-full rounded-2xl bg-emerald-700" disabled={reset.isPending}>
              {reset.isPending ? "Updating…" : "Reset password"}
            </Button>
          </>
        )}
        <FieldError message={serverError} />
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
