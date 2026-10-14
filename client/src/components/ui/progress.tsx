import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const reduced = useReducedMotion();
  const percent = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
      value={percent}
    >
      <ProgressPrimitive.Indicator asChild>
        <motion.div data-slot="progress-indicator" className="bg-primary h-full w-full flex-1" initial={false} animate={{ x: `${percent - 100}%` }} transition={{ duration: reduced ? 0 : .65, ease: "easeOut" }} />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
