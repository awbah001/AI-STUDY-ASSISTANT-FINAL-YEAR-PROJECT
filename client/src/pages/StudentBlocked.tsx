import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { clearAuthToken } from "@/lib/authToken";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

/**
 * Shown when a student account tries to access the web portal.
 * The web portal is for admin and lecturer only.
 */
export default function StudentBlocked() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSettled: () => {
      clearAuthToken();
      utils.auth.me.setData(undefined, null);
      setLocation("/login");
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-white p-6">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-900/5">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10">
          <Smartphone className="h-10 w-10 text-emerald-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Use the mobile app
          </h1>
          <p className="text-sm text-slate-500">
            This web portal is for <strong>lecturers and admins</strong> only. As a
            student, please download the <strong>Cognify</strong> mobile app on your
            phone to access your courses, flashcards, quizzes, and more.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            📱 Download <strong>Cognify</strong> from the App Store or Google Play
          </div>
          <Button
            variant="outline"
            className="w-full rounded-2xl"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
