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
import { useCallback, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Students must use the mobile app — block them on the web
      if (data.user.role === "user") {
        toast.error(
          "Students must use the Cognify mobile app. Please download it on your phone."
        );
        return;
      }
      setAuthToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      toast.success("Signed in");
      setLocation(getDashboardPathForRole(data.user.role));
    },
    onError: (err) => toast.error(err.message || "Failed to sign in"),
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
    login.mutate({ email: values.email, password: values.password });
  });

  return (
    <AuthLayout
      title="Welcome Back 👋"
      subtitle="Sign in to the lecturer or admin portal."
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
              placeholder="name@example.com"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
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
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={form.watch("rememberMe") ?? false}
              onCheckedChange={(v) => form.setValue("rememberMe", Boolean(v))}
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-emerald-600 hover:underline">Forgot password?</Link>
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

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <strong>Students:</strong> Use the Cognify mobile app, not this staff portal.
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Lecturer accounts are created by the administrator.
        </div>
      </form>
    </AuthLayout>
  );
}
