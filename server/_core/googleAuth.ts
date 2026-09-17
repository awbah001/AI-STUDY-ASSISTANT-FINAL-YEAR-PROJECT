import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "./env";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

export function googleOpenId(sub: string) {
  return `google:${sub}`;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (ENV.googleClientIds.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.googleClientIds,
  });

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!email || !sub) {
    throw new Error("Google token is missing email or subject");
  }
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new Error("Google email is not verified");
  }

  return {
    sub,
    email,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0],
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
