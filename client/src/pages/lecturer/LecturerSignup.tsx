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
import { User, Mail, Lock, GraduationCap } from "lucide-react";

const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    department: z.string().max(120).optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function LecturerSignup() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", department: "" },
  });

  const signup = trpc.lecturer.signup.useMutation({
    onSuccess: (data) => {
      setAuthToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      toast.success("Lecturer account created");
      setLocation(getDashboardPathForRole(data.user.role));
    },
    onError: (err) => toast.error(err.message || "Failed to create account"),
  });

  const onSubmit = form.handleSubmit(({ name, email, password, department }) => {
    signup.mutate({ name, email, password, department: department || undefined });
  });

  return (
    <AuthLayout
      title="Lecturer registration"
      subtitle="Create your teaching account to manage courses and students."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 flex gap-3 text-sm text-indigo-900">
          <GraduationCap className="h-5 w-5 shrink-0 text-indigo-600" />
          <p>Upload materials, track student progress, and generate AI quizzes from your lecture content.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="name" className="h-11 rounded-2xl pl-11" placeholder="Dr. Jane Smith" {...form.register("name")} />
          </div>
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">University email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="email" type="email" className="h-11 rounded-2xl pl-11" {...form.register("email")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department (optional)</Label>
          <Input id="department" className="h-11 rounded-2xl" placeholder="Computer Science" {...form.register("department")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="password" type="password" className="h-11 rounded-2xl pl-11" {...form.register("password")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="confirmPassword" type="password" className="h-11 rounded-2xl pl-11" {...form.register("confirmPassword")} />
          </div>
        </div>

        <Button
          type="submit"
          disabled={signup.isPending}
          className="w-full h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 hover:bg-emerald-500/25 hover:text-emerald-800"
        >
          {signup.isPending ? "Creating..." : "Create lecturer account"}
        </Button>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <div>
            Already registered?{" "}
            <Link href="/login" className="text-indigo-600 hover:underline">
              Sign in
            </Link>
          </div>
          <div>
            Student?{" "}
            <Link href="/signup" className="text-emerald-600 hover:underline">
              Student sign up
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
