import { useEffect, useRef, type ReactNode } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

export function AnimatedStatValue({ value }: { value: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const visible = useInView(ref, { once: true });
  const match = String(value ?? "").match(/^(-?\d+(?:\.\d+)?)(%?)$/);
  const number = match ? Number(match[1]) : null;
  const decimals = match?.[1].split(".")[1]?.length ?? 0;
  const suffix = match?.[2] ?? "";
  const previous = useRef(0);
  useEffect(() => {
    if (number === null || !ref.current) return;
    if (reduced || !visible) { ref.current.textContent = `${number}${suffix}`; previous.current = visible ? number : 0; return; }
    const controls = animate(previous.current, number, { duration: .65, ease: "easeOut", onUpdate: value => {
      if (ref.current) ref.current.textContent = `${value.toFixed(decimals)}${suffix}`;
    } });
    previous.current = number;
    return () => controls.stop();
  }, [number, decimals, suffix, reduced, visible]);
  if (!match) return <>{value}</>;
  return <span aria-label={String(value)}><span ref={ref} aria-hidden="true">{value}</span></span>;
}
