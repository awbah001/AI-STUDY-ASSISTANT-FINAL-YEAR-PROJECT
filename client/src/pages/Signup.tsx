import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
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
import { User, Mail, Lock } from "lucide-react";

const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const signup = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      setAuthToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      toast.success("Account created");
      setLocation(getDashboardPathForRole(data.user.role));
    },
    onError: (err) => toast.error(err.message || "Failed to create account"),
  });

  const onSubmit = form.handleSubmit(({ name, email, password }) => {
    signup.mutate({ name, email, password });
  });

  return (
    <AuthLayout title="Create account" subtitle="Get started in less than a minute.">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm">Name</Label>
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <User className="h-3.5 w-3.5" />
            </div>
            <Input
              id="name"
              autoComplete="name"
              className="h-9 rounded-xl pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-sm"
              placeholder="John Doe"
              {...form.register("name")}
            />
          </div>
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm">Email</Label>
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="h-9 rounded-xl pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-sm"
              placeholder="name@example.com"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm">Password</Label>
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-9 rounded-xl pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-sm"
              placeholder="Min. 8 characters"
              {...form.register("password")}
            />
          </div>
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm">Confirm password</Label>
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="h-9 rounded-xl pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-sm"
              placeholder="••••••••"
              {...form.register("confirmPassword")}
            />
          </div>
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button
          className="w-full h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white mt-1"
          type="submit"
          disabled={signup.isPending}
        >
          {signup.isPending ? "Creating..." : "Create account"}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-600 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

