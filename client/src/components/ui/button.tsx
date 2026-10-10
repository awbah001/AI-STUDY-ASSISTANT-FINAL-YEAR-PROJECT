import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-burgundy-border bg-white text-burgundy shadow-xs hover:bg-burgundy-soft hover:text-burgundy-hover dark:bg-transparent dark:text-burgundy-foreground dark:hover:bg-burgundy-soft",
        secondary:
          "border border-neutral-gray-border bg-neutral-gray-soft text-slate-700 hover:bg-slate-200/70 dark:text-slate-100 dark:hover:bg-slate-700/60",
        ghost:
          "text-neutral-gray hover:bg-neutral-gray-soft hover:text-slate-800 dark:hover:text-slate-100",
        link: "text-emerald-600 underline-offset-4 hover:underline hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
        accent:
          "bg-burgundy text-white shadow-sm hover:bg-burgundy-hover active:bg-burgundy-hover",
        "accent-outline":
          "border border-burgundy-border bg-white text-burgundy shadow-xs hover:bg-burgundy-soft hover:text-burgundy-hover dark:bg-transparent dark:text-burgundy-foreground",
        neutral:
          "border border-neutral-gray-border bg-white text-neutral-gray shadow-xs hover:bg-neutral-gray-soft hover:text-slate-700 dark:bg-transparent dark:hover:text-slate-200",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
