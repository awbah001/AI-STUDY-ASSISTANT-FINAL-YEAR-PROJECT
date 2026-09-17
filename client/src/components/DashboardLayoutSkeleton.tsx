import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#033c35] p-3">
      <div className="hidden w-[248px] rounded-[28px] border border-white/10 bg-[#033c35] p-4 space-y-6 md:block">
        <div className="flex items-center gap-3 px-1">
          <Skeleton className="h-11 w-11 rounded-2xl bg-white/15" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-white/15" />
            <Skeleton className="h-2 w-16 bg-white/10" />
          </div>
        </div>
        <div className="space-y-2 px-1">
          <Skeleton className="h-10 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-10 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-10 w-full rounded-2xl bg-white/10" />
        </div>
      </div>
      <div className="flex-1 space-y-4 rounded-[28px] bg-[#f4f8f6] p-6">
        <Skeleton className="h-12 w-48 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
