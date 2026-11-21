import type { LucideIcon } from "lucide-react";

export function WorkspacePageHeading({ title, description, icon: Icon, eyebrow = "Your workspace" }: {
  title: string;
  description?: string;
  icon: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <header className="workspace-banner workspace-account-heading">
      <span className="workspace-heading-icon"><Icon aria-hidden="true" /></span>
      <div><p className="workspace-kicker">{eyebrow}</p><h1>{title}</h1>{description && <p className="workspace-heading-description">{description}</p>}</div>
      <Icon className="workspace-heading-watermark" aria-hidden="true" />
    </header>
  );
}
