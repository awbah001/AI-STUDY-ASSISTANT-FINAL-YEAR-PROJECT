import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { toast } from "sonner";
import { setAuthToken } from "@/lib/authToken";
import { getDashboardPathForRole } from "@shared/const";
import { ALLOWED_EMAIL_DOMAIN } from "@shared/emailDomain";
import { validateEmail, validateLoginPassword, validateTotpCode } from "@shared/validation";
import { fromValidator } from "@/lib/formValidation";
import { FieldError } from "@/components/FieldError";
import { useCallback, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const schema = z.object({
  email: fromValidator(v => validateEmail(v)),
  password: fromValidator(validateLoginPassword),
  totpCode: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [showPassword, setShowPassword] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", totpCode: "", rememberMe: true },
  });
  const { errors } = form.formState;

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuthToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      toast.success("Signed in");
      setLocation(getDashboardPathForRole(data.user.role));
    },
    onError: (err) => {
      if (err.data?.code === "PRECONDITION_FAILED") {
        setNeedsTotp(true);
        toast.message("Enter your authenticator code to continue.");
        return;
      }
      toast.error(err.message || "Failed to sign in");
    },
  });

  const googleLogin = trpc.auth.google.useMutation({
    onSuccess: (data) => {
      setAuthToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      toast.success("Signed in with Google");
      setLocation(getDashboardPathForRole(data.user.role));
    },
    onError: (err) => toast.error(err.message || "Google sign-in failed"),
  });

  const onGoogleCredential = useCallback(
    (idToken: string) => {
      googleLogin.mutate({ idToken, client: "web" });
    },
    [googleLogin]
  );

  const onSubmit = form.handleSubmit((values) => {
    if (needsTotp) {
      const codeError = validateTotpCode(values.totpCode);
      if (codeError) {
        form.setError("totpCode", { message: codeError });
        return;
      }
    }
    login.mutate({
      email: values.email,
      password: values.password,
      totpCode: values.totpCode || undefined,
    });
  });

  return (
    <AuthLayout
      title="Welcome Back 👋"
      subtitle="Sign in to your Course-Specific AI Learning Assistant account."
      noScroll
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Mail className="h-4 w-4" />
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-11 transition-all focus:bg-white"
              placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
          </div>
          <FieldError id="email-error" message={errors.email?.message} />
        </div>

        <div className="space-y-1.5">
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Lock className="h-4 w-4" />
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-11 pr-11 transition-all focus:bg-white"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        {needsTotp ? (
          <div className="space-y-1.5">
            <Input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={64}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
              placeholder="6-digit authenticator code"
              aria-invalid={Boolean(errors.totpCode)}
              {...form.register("totpCode")}
            />
            <FieldError message={errors.totpCode?.message} />
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={form.watch("rememberMe") ?? false}
              onCheckedChange={(v) => form.setValue("rememberMe", Boolean(v))}
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-burgundy hover:underline">Forgot password?</Link>
        </div>

        <Button
          className="h-11 w-full gap-2 rounded-xl bg-[#07855f] text-sm text-white shadow-md shadow-emerald-700/15 hover:bg-[#057554]"
          type="submit"
          disabled={login.isPending || googleLogin.isPending}
        >
          {login.isPending ? "Signing in..." : <><span>Sign In</span><ArrowRight className="h-4 w-4" /></>}
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <GoogleSignInButton onCredential={onGoogleCredential} pending={googleLogin.isPending} />

        <p className="text-center text-xs text-neutral-gray">
          Use your <span className="font-semibold text-burgundy">@{ALLOWED_EMAIL_DOMAIN}</span> email. New students can continue with Google.
        </p>
      </form>
    </AuthLayout>
  );
}
