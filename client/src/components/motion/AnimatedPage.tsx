import { useEffect, type ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { motionTokens } from "./AnimatedCard";

export function AnimatedPage({ routeKey, className, children }: { routeKey: string; className?: string; children: ReactNode }) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { controls.set({ opacity: 1, y: 0 }); return; }
    controls.set({ opacity: .5, y: 6 });
    void controls.start({ opacity: 1, y: 0, transition: motionTokens.enter });
    return () => controls.stop();
  }, [routeKey, reduced, controls]);
  return <motion.div className={className} animate={controls}>{children}</motion.div>;
}
