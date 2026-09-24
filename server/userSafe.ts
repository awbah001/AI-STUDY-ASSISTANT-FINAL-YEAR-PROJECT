import type { User } from "../drizzle/schema";

export function stripSensitiveUser(u: User) {
  const { passwordHash: _p, totpSecret: _s, totpRecoveryHashes: _r, ...safe } = u;
  return safe;
}
