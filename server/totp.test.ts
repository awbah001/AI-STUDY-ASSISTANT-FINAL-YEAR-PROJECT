import { describe, expect, it } from "vitest";
import { consumeRecoveryCode, generateRecoveryCodes, generateTotpSecret, verifyTotp } from "./totp";

describe("totp", () => {
  it("generates a secret and rejects empty codes", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(10);
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("consumes a matching recovery code once", () => {
    const { plain, hashes } = generateRecoveryCodes();
    const remaining = consumeRecoveryCode(hashes, plain[0]!);
    expect(remaining).not.toBeNull();
    expect(remaining).toHaveLength(hashes.length - 1);
    expect(consumeRecoveryCode(remaining!, plain[0]!)).toBeNull();
  });
});
