import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StaffWelcomeBanner({
  name,
  body,
  actionLabel,
  onAction,
}: {
  name: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const greetingName = (name.trim().split(/\s+/)[0] || "there").toUpperCase();

  return (
    <section className="staff-welcome" aria-label="Welcome">
      <span className="staff-welcome-sparkle s1" />
      <span className="staff-welcome-sparkle s2" />
      <span className="staff-welcome-sparkle s3" />
      <div className="staff-welcome-waves" aria-hidden="true" />

      <div className="staff-welcome-copy">
        <p className="staff-welcome-kicker">Welcome back, {greetingName}.</p>
        <h1>Good to see you again!</h1>
        <p className="staff-welcome-body">{body}</p>
        <Button type="button" className="staff-welcome-cta" onClick={onAction}>
          {actionLabel} <ArrowRight />
        </Button>
      </div>

      <div className="staff-welcome-mascot">
        <div className="staff-welcome-bubble">How can I help you today?</div>
        <img src="/cognify-auth-bot.png?v=2" alt="" />
      </div>
    </section>
  );
}
