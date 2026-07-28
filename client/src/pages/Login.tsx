import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { toast } from "sonner";
import { setAuthToken } from "@/lib/authToken";
import { getDashboardPathForRole } from "@shared/const";
import { Mail, Lock } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

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

  const onSubmit = form.handleSubmit((values) => {
    login.mutate({ email: values.email, password: values.password });
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your details to access your workspace."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Mail className="h-4 w-4" />
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="h-11 rounded-2xl pl-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              placeholder="name@example.com"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Lock className="h-4 w-4" />
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-11 rounded-2xl pl-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              placeholder="••••••••"
              {...form.register("password")}
            />
          </div>
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>
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
          <span className="text-sm text-muted-foreground">Forgot password?</span>
        </div>

        <Button
          className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
          type="submit"
          disabled={login.isPending}
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </Button>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Students:</strong> This portal is for staff only. Please use the{" "}
          <span className="font-semibold">Cognify mobile app</span> on your phone to access your courses.
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Lecturer accounts are created by the administrator.
        </div>
      </form>
    </AuthLayout>
  );
}

