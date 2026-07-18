import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  accent: string;
  description?: string;
};

export function LecturerStatCard({ label, value, icon, accent, description }: Props) {
  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {value === null ? (
              <Skeleton className="h-9 w-16 mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-1 text-slate-900">{value}</p>
            )}
            {description ? (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            ) : null}
          </div>
          <div
            className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
