import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  User,
  Lock,
  Mail,
  LogIn,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Link } from "wouter";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 3 * 1024 * 1024;

export default function Profile() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [name, setName] = useState(user?.name ?? "");
  useEffect(() => { setName(user?.name ?? ""); }, [user?.name]);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await refresh();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e.message || "Could not update profile"),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast.success("Password changed");
    },
    onError: (e) => toast.error(e.message || "Could not change password"),
  });

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    if (trimmed === user?.name) return;
    updateProfile.mutate({ name: trimmed });
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) { toast.error("Use JPEG, PNG, WebP, or GIF"); return; }
    if (file.size > MAX_BYTES) { toast.error("Image must be 3 MB or smaller"); return; }
    setAvatarUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "gif";
      const key = `avatars/${user?.id ?? "me"}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, new Uint8Array(buf), file.type);
      await updateProfile.mutateAsync({ avatarUrl: url });
    } catch { toast.error("Upload failed"); }
    finally { setAvatarUploading(false); }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("New passwords do not match"); return; }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  const saving = updateProfile.isPending;
  const pwBusy = changePassword.isPending;
  const isLocalAccount = user?.loginMethod === "local";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information and account security.
          </p>
        </div>

        {/* ── Avatar & Name card ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <User className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Photo &amp; Name</p>
              <p className="text-xs text-slate-500">Your public display name and profile photo</p>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="h-24 w-24 rounded-2xl border-2 border-slate-100 shadow-sm">
                  {user?.avatarUrl
                    ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover rounded-2xl" />
                    : null}
                  <AvatarFallback className="rounded-2xl bg-emerald-600 text-2xl font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading || saving}
                  className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  aria-label="Upload photo"
                >
                  {avatarUploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleAvatarPick} />
              </div>

              {/* Name field */}
              <div className="flex-1 space-y-4 w-full min-w-0">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name" className="text-sm font-medium text-slate-700">Display name</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                    className="rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveName}
                    disabled={saving || name.trim() === (user?.name ?? "")}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    size="sm"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Save name
                  </Button>
                  {user?.avatarUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateProfile.mutate({ avatarUrl: "" })}
                      disabled={saving}
                      className="rounded-xl border-slate-200"
                    >
                      Remove photo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Account info card ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Account Information</p>
              <p className="text-xs text-slate-500">Your login details</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            <InfoRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Email" value={user?.email ?? "—"} />
            <InfoRow icon={<LogIn className="h-4 w-4 text-slate-400" />} label="Sign-in method" value={user?.loginMethod ?? "—"} />
            <InfoRow
              icon={<User className="h-4 w-4 text-slate-400" />}
              label="Role"
              value={
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  user?.role === "admin" ? "bg-red-50 text-red-700" :
                  user?.role === "lecturer" ? "bg-indigo-50 text-indigo-700" :
                  "bg-emerald-50 text-emerald-700"
                }`}>
                  {user?.role === "admin" ? "Administrator" : user?.role === "lecturer" ? "Lecturer" : "Student"}
                </span>
              }
            />
          </div>
        </div>

        {/* ── Change password card ── */}
        {isLocalAccount && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Change Password</p>
                <p className="text-xs text-slate-500">Use a strong password you don't reuse elsewhere</p>
              </div>
            </div>
            <div className="px-6 py-6">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-sm font-medium text-slate-700">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-sm font-medium text-slate-700">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    minLength={8}
                    className="rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    minLength={8}
                    className="rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pwBusy || !currentPw || !newPw || !confirmPw}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  size="sm"
                >
                  {pwBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  {pwBusy ? "Updating…" : "Update password"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5">
      <div className="flex items-center gap-2.5 text-sm text-slate-500">
        {icon}
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-sm text-slate-600">{value}</span>
    </div>
  );
}
