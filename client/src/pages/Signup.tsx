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
      setLocation(data.user.role === "admin" ? "/admin" : "/dashboard");
    },
    onError: (err) => toast.error(err.message || "Failed to create account"),
  });

  const onSubmit = form.handleSubmit(({ name, email, password }) => {
    signup.mutate({ name, email, password });
  });

  return (
    <AuthLayout title="Create account" subtitle="Get started in less than a minute.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <User className="h-4 w-4" />
            </div>
            <Input
              id="name"
              autoComplete="name"
              className="h-11 rounded-2xl pl-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              placeholder="John Doe"
              {...form.register("name")}
            />
          </div>
          {form.formState.errors.name ? (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
          ) : null}
        </div>

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
              autoComplete="new-password"
              className="h-11 rounded-2xl pl-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              placeholder="••••••••"
              {...form.register("password")}
            />
          </div>
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-emerald-600">
              <Lock className="h-4 w-4" />
            </div>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="h-11 rounded-2xl pl-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              placeholder="••••••••"
              {...form.register("confirmPassword")}
            />
          </div>
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button
          className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
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

