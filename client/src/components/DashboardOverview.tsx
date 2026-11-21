import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { AppIcon, AppIconBadge, type IconName } from "@/components/icons/AppIcon";

export function DashboardHeading({ title, description }: { title: string; description: string }) {
  const today = new Date();
  return (
    <div className="dashboard-section-heading">
      <div>
        <p className="dashboard-section-eyebrow">YOUR OVERVIEW</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <time className="dashboard-date" dateTime={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`}>
        <AppIcon name="CalendarDays" size={14} />
        {today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </time>
    </div>
  );
}

export function DashboardShortcuts({ items }: {
  items: { title: string; description: string; href: string; icon: IconName | LucideIcon }[];
}) {
  return (
    <section className="dashboard-launchpad" aria-label="Workspace shortcuts">
      <div className="dashboard-launchpad-heading"><span>WORKSPACE TOOLKIT</span><p>A little less searching. A little more doing.</p></div>
      <div className="dashboard-shortcuts">
        {items.map(({ title, description, href, icon }, index) => {
          const ShortcutIcon = typeof icon === "string" ? null : icon;
          return <Link key={href} href={href} className="dashboard-shortcut">
            <span className="dashboard-tool-surface">
              {typeof icon === "string" ? <>
              <span className="dashboard-tool-topline"><span>{String(index + 1).padStart(2, "0")}</span><span className="dashboard-tool-dot" /></span>
              <AppIcon name={icon} className="dashboard-tool-watermark" mode="static" size={90} />
              <AppIconBadge name={icon} className="dashboard-shortcut-icon" size={44} />
              </> : <>
              <span className="dashboard-tool-topline"><span>{String(index + 1).padStart(2, "0")}</span><span className="dashboard-tool-dot" /></span>
              {ShortcutIcon && <ShortcutIcon className="dashboard-tool-watermark" size={90} aria-hidden="true" />}
              <span className="dashboard-shortcut-icon cognify-icon-badge">{ShortcutIcon && <ShortcutIcon size={22} aria-hidden="true" />}</span>
              </>}
              <span className="dashboard-shortcut-copy"><strong>{title}</strong><span>{description}</span></span>
              <span className="dashboard-tool-footer"><span>Let's go</span><span className="dashboard-tool-arrow-wrap"><ArrowUpRight className="dashboard-shortcut-arrow" aria-hidden="true" /></span></span>
            </span>
          </Link>;
        })}
      </div>
    </section>
  );
}
