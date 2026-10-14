import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const motionTokens = { spring: { stiffness: 230, damping: 28, mass: .65 }, enter: { duration: .32, ease: [.22, 1, .36, 1] as const } };

export function AnimatedCard({ as = "div", className, children, tilt = true, delay = 0 }: {
  as?: "div" | "section" | "article" | "header"; className?: string; children: ReactNode; tilt?: boolean; delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0), lift = useMotionValue(0);
  const rotateX = useSpring(x, motionTokens.spring), rotateY = useSpring(y, motionTokens.spring), elevation = useSpring(lift, motionTokens.spring);
  const lightX = useMotionValue(50), lightY = useMotionValue(0);
  const lighting = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(255,255,255,.22), transparent 58%)`;
  const Component = as === "section" ? motion.section : as === "article" ? motion.article : as === "header" ? motion.header : motion.div;
  const reset = () => { x.set(0); y.set(0); lift.set(0); };
  useEffect(() => {
    if (reduced) { x.jump(0); y.jump(0); lift.jump(0); rotateX.jump(0); rotateY.jump(0); elevation.jump(0); }
  }, [reduced, x, y, lift, rotateX, rotateY, elevation]);
  return <Component
    ref={ref as React.Ref<HTMLDivElement>}
    className={cn("depth-card", className)}
    initial={reduced ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: .06 }}
    transition={{ ...motionTokens.enter, delay: reduced ? 0 : Math.min(delay, .24) }}
    style={{ rotateX, rotateY, y: elevation, transformPerspective: 1000 }}
    onPointerMove={event => {
      if (reduced || !tilt || event.pointerType !== "mouse" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      x.set((.5 - py) * 4); y.set((px - .5) * 4); lift.set(-2);
      lightX.set(px * 100); lightY.set(py * 100);
    }} onPointerLeave={reset} onFocusCapture={reset}
  >{children}{tilt && <motion.span aria-hidden="true" className="depth-card-light" style={{ background: lighting }} />}</Component>;
}
