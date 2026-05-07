import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Globe, Lock, Search, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Fetch all documents across the platform
  const { data: analytics, isLoading, refetch } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const deleteMutation = trpc.admin.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document removed successfully.");
      refetch();
    },
  });

  const togglePublicMutation = trpc.admin.toggleDocumentPublic.useMutation({
    onSuccess: () => {
      toast.success("Document status updated.");
      refetch();
    },
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  // Extract all documents from analytics or fetch separately if needed
  // For now, let's assume we need a separate query for all documents if analytics doesn't have them all
  // But analytics has 'recentActivities' which includes documents.
  // I should probably add a getDocuments query to admin router.
  
  // Actually, I'll just use the existing analytics for now or assume I'll add a more specific query.
  // Let's add 'allDocuments' to the getAnalytics response or create a new query.
  
  const allDocs = (analytics as any)?.allDocuments || [];
  const filteredDocs = allDocs.filter((d: any) => 
    (d.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (d.userName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm shadow-emerald-900/5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  Platform Content
                </h2>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Manage all learning resources and moderate user-generated content.
              </p>
            </div>
            <Button 
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
              onClick={() => setLocation("/upload")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Resource
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search documents by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-2xl border-slate-200 dark:border-slate-700"
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Table */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
            <CardTitle className="text-lg">All Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-700/70 bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Owner</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Visibility</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Created</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200/80 dark:border-slate-700/70">
                        <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-9 w-24" /></td>
                      </tr>
                    ))
                  ) : filteredDocs.length > 0 ? (
                    filteredDocs.map((doc: any) => (
                      <tr key={doc.id} className="border-b border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{doc.title}</div>
                          <div className="text-xs text-slate-500">{doc.fileName}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{doc.userName}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${doc.isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                            {doc.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {doc.isPublic ? 'Public' : 'Private'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-2xl text-xs"
                              onClick={() => togglePublicMutation.mutate({ documentId: doc.id })}
                            >
                              {doc.isPublic ? 'Make Private' : 'Make Public'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-2xl text-xs text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                              onClick={() => {
                                if (confirm("Delete this document and all associated flashcards/quizzes?")) {
                                  deleteMutation.mutate({ documentId: doc.id });
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                        No content found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
