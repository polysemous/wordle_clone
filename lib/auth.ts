import { OAuth2Client } from "google-auth-library";
import type { Identity } from "./store";

const client = new OAuth2Client();

function friendlyName(email: string): string {
  const localPart = email.split("@")[0] ?? "Player";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Player";
}

export class AuthenticationError extends Error {}

export async function authenticate(headers: Headers): Promise<Identity> {
  const allowDev = process.env.ALLOW_DEV_AUTH === "true" || process.env.NODE_ENV === "development";
  if (allowDev) {
    const email = process.env.DEV_USER_EMAIL ?? "player@example.com";
    return {
      id: `dev:${email}`,
      email,
      suggestedName: process.env.DEV_USER_NAME ?? friendlyName(email),
    };
  }

  const token = headers.get("x-goog-iap-jwt-assertion");
  const audience = process.env.IAP_AUDIENCE;
  if (!token || !audience) {
    throw new AuthenticationError("A verified Google IAP identity is required.");
  }

  try {
    const { pubkeys } = await client.getIapPublicKeys();
    const ticket = await client.verifySignedJwtWithCertsAsync(
      token,
      pubkeys,
      audience,
      ["https://cloud.google.com/iap"],
    );
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error("Missing identity claims");
    return {
      id: payload.sub,
      email: payload.email,
      suggestedName: friendlyName(payload.email),
    };
  } catch {
    throw new AuthenticationError("The Google IAP identity could not be verified.");
  }
}
