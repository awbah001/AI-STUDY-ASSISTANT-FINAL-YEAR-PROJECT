import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function AnimatedProgressRing({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const pct = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 52;
  return <svg viewBox="0 0 124 124" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#30d49f" /><stop offset="100%" stopColor="#008f68" /></linearGradient></defs>
    <circle cx="62" cy="62" r="52" fill="none" stroke="var(--motion-ring-track, #e5eee9)" strokeWidth="11" />
    <motion.circle cx="62" cy="62" r="52" fill="none" stroke={`url(#${id})`} strokeWidth="11" strokeLinecap="round"
      strokeDasharray={circumference} initial={reduced ? false : { strokeDashoffset: circumference }}
      whileInView={{ strokeDashoffset: circumference * (1 - pct / 100) }} viewport={{ once: true }}
      transition={{ duration: reduced ? 0 : .8, ease: "easeOut" }} style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
  </svg>;
}
