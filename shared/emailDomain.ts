export const ALLOWED_EMAIL_DOMAIN = "central.edu.sl";

export const EMAIL_DOMAIN_ERROR = `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can use this system.`;

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
