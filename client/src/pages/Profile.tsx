import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Link } from "wouter";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 3 * 1024 * 1024;

export default function Profile() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

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
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Password changed");
    },
    onError: (e) => toast.error(e.message || "Could not change password"),
  });

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const isLocalAccount = user?.loginMethod === "local";
  const canChangePassword = isLocalAccount;

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    if (trimmed === user?.name) return;
    updateProfile.mutate({ name: trimmed });
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please use JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 3MB or smaller");
      return;
    }

    setAvatarUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const ext =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "gif";
      const key = `avatars/${user?.id ?? "me"}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, new Uint8Array(buf), file.type);
      await updateProfile.mutateAsync({ avatarUrl: url });
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    updateProfile.mutate({ avatarUrl: "" });
  };

  const handleChangePassword = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  const [avatarUploading, setAvatarUploading] = useState(false);
  const saving = updateProfile.isPending;
  const pwBusy = changePassword.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-2">
            Update your photo and display name. Change your password for email login.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Photo & name</CardTitle>
            <CardDescription>Your name is shown in the app header and on your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative">
                <Avatar className="h-28 w-28 border-2 border-border shadow-sm">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-2xl font-medium">
                    {user?.name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading || saving}
                  className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:opacity-90 disabled:opacity-50"
                  aria-label="Upload photo"
                >
                  {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </div>

              <div className="flex-1 space-y-3 w-full min-w-0">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Display name</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSaveName} disabled={saving || name.trim() === (user?.name ?? "")}>
                    Save name
                  </Button>
                  {user?.avatarUrl ? (
                    <Button type="button" variant="outline" onClick={handleRemovePhoto} disabled={saving}>
                      Remove photo
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLocalAccount ? (
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Use a strong password you do not reuse elsewhere.</CardDescription>
            </CardHeader>
            <CardContent>
              {canChangePassword ? (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" disabled={pwBusy}>
                    {pwBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Change password"
                    )}
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">Email</span> — {user?.email ?? "—"}
            </p>
            <p>
              <span className="font-medium text-foreground">Sign-in</span> — {user?.loginMethod ?? "—"}
            </p>
            <p className="pt-2">
              <Link href="/settings" className="text-primary font-medium hover:underline">
                Settings
              </Link>{" "}
              — theme and other preferences
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
