import type { ReactNode } from "react";
import { BookOpen, GraduationCap, ShieldCheck, Settings, Megaphone, FileText, BarChart3, Users, type LucideIcon } from "lucide-react";

export function LecturerHero({ title, eyebrow, description, icon: Icon = BookOpen, actions }: { title: string; eyebrow?: string; description?: string; icon?: LucideIcon; actions?: ReactNode }) {
  const ArtIcon = /Settings/.test(title) ? Settings : /Profile/.test(title) ? ShieldCheck : /Announcements/.test(title) ? Megaphone : /Reports/.test(title) ? BarChart3 : /Assessments/.test(title) ? FileText : GraduationCap;
  const tone = /Settings/.test(title) ? "gray" : /Profile/.test(title) ? "indigo" : /Announcements/.test(title) ? "pink" : /Reports/.test(title) ? "amber" : /Assessments/.test(title) ? "rose" : /Analytics/.test(title) ? "sky" : /Students/.test(title) ? "violet" : /Courses?/.test(title) ? "blue" : undefined;
  return <header className="lecturer-hero">
    <div className="lecturer-hero-copy"><span className="lecturer-hero-icon" data-tone={tone}><Icon /></span><div><p className="lecturer-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>
    <div className="lecturer-hero-art" aria-hidden="true"><span className="art-orbit"/><span className="art-dot"/><div className="art-book art-book-back"/><div className="art-book"/><div className="art-symbol"><ArtIcon strokeWidth={1.35}/></div><div className="art-note"><span/><span/><span/></div></div>
    {actions && <div className="lecturer-hero-actions">{actions}</div>}
  </header>;
}

export function LecturerStats({ items }: { items: { label: string; value: ReactNode; hint: string; icon?: LucideIcon }[] }) {
  return <section className="lecturer-stats">{items.map(({ label, value, hint, icon: Icon = Users }, i) => <div className={`lecturer-stat lecturer-tone-${i % 4}`} key={label}><span className="lecturer-stat-icon"><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{hint}</small></div></div>)}</section>;
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map(row => row.map(value => { const text = String(value ?? ""); return `"${(/^[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
