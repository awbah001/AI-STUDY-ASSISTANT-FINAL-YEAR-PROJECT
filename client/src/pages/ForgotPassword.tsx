import { useState } from "react";
import { Link } from "wouter";
import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  const request = trpc.auth.forgotPassword.useMutation({ onSuccess: () => setSent(true) });
  return <AuthLayout title="Reset your password" subtitle="Enter your staff email and we will send a secure reset link."><form className="space-y-5" onSubmit={e => { e.preventDefault(); request.mutate({ email }); }}>{sent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">If a Cognify staff account uses this email, a reset link has been sent. Check your inbox and spam folder.</div> : <><div className="space-y-2"><Label htmlFor="reset-email">Email</Label><div className="relative"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="reset-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="lecturer@university.edu" className="h-12 rounded-2xl pl-11" /></div></div><Button className="h-12 w-full rounded-2xl bg-emerald-700" disabled={request.isPending}>{request.isPending ? "Sending…" : "Send reset link"}</Button>{request.error && <p className="text-sm text-destructive">Unable to request a reset. Please try again.</p>}</>}<p className="text-center text-sm text-slate-500"><Link href="/login" className="font-medium text-emerald-700 hover:underline">Back to sign in</Link></p></form></AuthLayout>;
}
