import { useState } from "react";
import { Link, useLocation } from "wouter";
import AuthLayout from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function ResetPassword() {
  const [, setLocation] = useLocation(); const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => setLocation("/login"), onError: e => setError(e.message) });
  return <AuthLayout title="Choose a new password" subtitle="Use a strong password with at least 8 characters."><form className="space-y-5" onSubmit={e => { e.preventDefault(); if (!token) return setError("This reset link is invalid or incomplete."); if (password.length < 8) return setError("Password must be at least 8 characters."); if (password !== confirm) return setError("Passwords do not match."); setError(""); reset.mutate({ token, newPassword: password }); }}>{!token ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">This reset link is invalid or incomplete. Request a new one.</div> : <><label className="block space-y-2"><Label>New password</Label><Input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-2xl" /></label><label className="block space-y-2"><Label>Confirm new password</Label><Input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="h-12 rounded-2xl" /></label><Button className="h-12 w-full rounded-2xl bg-emerald-700" disabled={reset.isPending}>{reset.isPending ? "Updating…" : "Reset password"}</Button></>}{error && <p className="text-sm text-destructive">{error}</p>}<p className="text-center text-sm text-slate-500"><Link href="/login" className="font-medium text-emerald-700 hover:underline">Back to sign in</Link></p></form></AuthLayout>;
}
