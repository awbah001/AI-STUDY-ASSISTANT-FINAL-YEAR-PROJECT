import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Trash2, Plus, Search, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function DocumentsLibrary() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: documents, isLoading } = trpc.documents.list.useQuery();
  const { data: favorites } = trpc.documents.favorites.useQuery();
  const { data: searchResults, isLoading: isSearching } = trpc.documents.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0 }
  );
  const toggleFavoriteMutation = trpc.documents.toggleFavorite.useMutation({
    onSuccess: () => {
      toast.success("Favorite updated");
      void utils.documents.list.invalidate();
      void utils.documents.favorites.invalidate();
    },
  });

  const deleteDocumentMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      void utils.documents.list.invalidate();
      void utils.documents.favorites.invalidate();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const utils = trpc.useUtils();

  const displayDocs = showFavoritesOnly
    ? favorites
    : debouncedQuery.length > 0
    ? searchResults
    : documents;
  const filtered = displayDocs;
  const isLoading_ = showFavoritesOnly ? isLoading : debouncedQuery.length > 0 ? isSearching : isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Document Library</h1>
            <p className="text-muted-foreground mt-2">
              Manage and organize your learning documents
            </p>
          </div>
          <Button
            onClick={() => setLocation("/upload")}
            size="lg"
            className="gap-2 rounded-2xl shadow-md shadow-emerald-600/15"
          >
            <Plus className="w-4 h-4" />
            Upload
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="gap-2"
          >
            <Heart className="w-4 h-4" />
            Favorites
          </Button>
        </div>

        {/* Documents Grid */}
        {isLoading_ ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <Card
                key={doc.id}
                className="group cursor-pointer rounded-3xl border-emerald-100/80 shadow-sm transition-all hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 dark:border-emerald-900/40"
                onClick={() => setLocation(`/document/${doc.id}`)}
              >
                <CardContent className="flex h-full flex-col justify-between p-6">
                  <div>
                    <h3 className="mb-2 line-clamp-2 text-lg font-semibold transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-emerald-50/90 pt-4 dark:border-emerald-950/50">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                      {(doc as any).isPublic && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                          <Globe className="h-2.5 w-2.5" />
                          PUBLIC
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this document?")) {
                            deleteDocumentMutation.mutate({ id: doc.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteMutation.mutate({ id: doc.id });
                        }}
                        className={doc.isFavorite ? "text-red-500" : "text-muted-foreground"}
                      >
                        <Heart
                          className="w-4 h-4"
                          fill={doc.isFavorite ? "currentColor" : "none"}
                        />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl border-dashed border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-800 dark:bg-emerald-950/20">
            <CardContent className="p-12 text-center">
              <p className="mb-4 text-muted-foreground">
                {showFavoritesOnly ? "No favorite documents yet" : "No documents found"}
              </p>
              <Button className="rounded-2xl" onClick={() => setLocation("/upload")}>
                Upload a document
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
