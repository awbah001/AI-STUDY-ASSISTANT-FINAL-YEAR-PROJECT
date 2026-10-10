import { useId } from "react";

/** Decorative trend artwork, not an additional source of analytics data. */
export function AdminSparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, index) => ({
    x: index * 100 / Math.max(values.length - 1, 1),
    y: 36 - (value - min) / Math.max(max - min, 1) * 30,
  }));
  const curve = points.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const mid = (previous.x + point.x) / 2;
    return `${path} C ${mid} ${previous.y}, ${mid} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  return <svg width="100" height="42" viewBox="0 0 100 42" aria-hidden="true" className="shrink-0">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".22"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <path d={`${curve} L 100 42 L 0 42 Z`} fill={`url(#${id})`} />
    <path d={curve} stroke={color} fill="none" strokeWidth="1.4" strokeLinecap="round" />
  </svg>;
}
