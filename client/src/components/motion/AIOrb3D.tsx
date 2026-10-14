import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useMotionValue, useSpring } from "framer-motion";

/** CSS 3D geometry avoids a WebGL runtime and always has a static fallback. */
export default function AIOrb3D({ thinking = false, listening = false, compact = false }: { thinking?: boolean; listening?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(true);
  const lowPower = typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
  const active = visible && foreground && !reduced && !lowPower;
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 180, damping: 24 }), rotateY = useSpring(ry, { stiffness: 180, damping: 24 });
  useEffect(() => {
    if (!active) { rx.jump(0); ry.jump(0); rotateX.jump(0); rotateY.jump(0); }
  }, [active, rx, ry, rotateX, rotateY]);
  useEffect(() => {
    const update = () => setForeground(document.visibilityState === "visible");
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div ref={ref} aria-hidden="true" className={`ai-orb ${compact ? "ai-orb--compact" : ""} ${thinking ? "ai-orb--thinking" : ""} ${listening ? "ai-orb--listening" : ""}`} data-animate={active}
    onPointerMove={event => {
      if (!active || event.pointerType !== "mouse") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      rx.set((.5 - (event.clientY - bounds.top) / bounds.height) * 10);
      ry.set(((event.clientX - bounds.left) / bounds.width - .5) * 10);
    }} onPointerLeave={() => { rx.set(0); ry.set(0); }}>
    <div className="ai-orb-halo" />
    <motion.div className="ai-orb-space" style={{ rotateX, rotateY }}>
      <div className="ai-orb-core"><span /><span /><span /></div>
      <div className="ai-orb-ring ai-orb-ring--one"><i /></div>
      <div className="ai-orb-ring ai-orb-ring--two"><i /></div>
      <div className="ai-orb-ring ai-orb-ring--three"><i /></div>
      <div className="ai-orb-node ai-orb-node--one" /><div className="ai-orb-node ai-orb-node--two" />
    </motion.div>
    <div className="ai-orb-shadow" />
  </div>;
}
