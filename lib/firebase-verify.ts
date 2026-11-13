/**
 * Server-side Firebase ID token verification — ported from the Case Management
 * system's server/lib/auth.js (which used the public securetoken certs so no
 * Firebase service-account key is needed). Here we use `jose` (already a
 * dependency of the auth stack) against Firebase's published JWKS.
 *
 * Verifies signature (RS256), issuer, audience, and expiry — identity only.
 */
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// Cached across requests; handles key rotation and picks the right key by `kid`.
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export type FirebaseClaims = {
  sub: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
  picture?: string;
};

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseClaims> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID not set");
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
  });
  return payload as FirebaseClaims;
}