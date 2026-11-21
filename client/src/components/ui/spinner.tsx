import { cn } from "@/lib/utils";

function Spinner({ className, size, ...props }: React.ComponentProps<"svg"> & { size?: number | string }) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 86 86"
      fill="none"
      className={cn(size == null && "size-4", "wifi-loader", className, "animate-none")}
      {...props}
    >
      {[
        { name: "outer", radius: 40, dash: "62.75 188.25" },
        { name: "middle", radius: 27.05, dash: "42.5 127.5" },
        { name: "inner", radius: 14, dash: "22 66" },
      ].map(({ name, radius, dash }) => (
        <g className={`wifi-ring wifi-ring-${name}`} key={name}>
          <circle className="wifi-back" cx="43" cy="43" r={radius} strokeDasharray={dash} />
          <circle className="wifi-front" cx="43" cy="43" r={radius} strokeDasharray={dash} />
        </g>
      ))}
    </svg>
  );
}

function LoadingIndicator({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("wifi-loading-state", className)}>
      <Spinner className="size-[86px]" aria-hidden="true" role="presentation" />
      <span className="wifi-loading-text" data-text={label} aria-hidden="true">{label}</span>
    </div>
  );
}

export { Spinner, LoadingIndicator };
