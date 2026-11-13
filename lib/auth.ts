import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { verifyFirebaseIdToken } from "./firebase-verify";
import { recordAudit } from "./audit";
import { headers } from "next/headers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      roles: string;
      scopeEntity?: string | null;
      scopeDept?: string | null;
    };
  }
  interface User {
    role: string;
    roles: string;
    scopeEntity?: string | null;
    scopeDept?: string | null;
  }
}

type LoginMethod = "PASSWORD" | "GOOGLE";

/** Best-effort client IP from proxy headers (works within the auth route handler). */
async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

/** Record a login event. Audit failures must never block sign-in. */
async function logLogin(
  userId: string,
  action: "LOGIN_SUCCESS" | "LOGIN_FAILURE",
  ip: string | null,
  details: Record<string, unknown>,
) {
  try {
    await recordAudit({ entity: "Auth", entityId: userId, action, diff: details, userId, ip });
  } catch {
    /* ignore */
  }
}

// Shared gate for both providers: enforce the account is active, stamp
// last-login, log the outcome, and return the session user shape (or null).
// This only decides *whether an already-identified user may in* — it does not
// alter how identity is proven.
async function finalizeLogin(
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    roles: string;
    active: boolean;
    scopeEntity: string | null;
    scopeDept: string | null;
  },
  method: LoginMethod,
  ip: string | null,
) {
  if (!user.active) {
    await logLogin(user.id, "LOGIN_FAILURE", ip, { method, reason: "inactive" });
    return null;
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logLogin(user.id, "LOGIN_SUCCESS", ip, { method });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles: user.roles ?? user.role,
    scopeEntity: user.scopeEntity,
    scopeDept: user.scopeDept,
  };
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  trustHost: true,
  providers: [
    // Firebase Google sign-in.
    // The browser signs in with Firebase and posts the Firebase ID token here;
    // we verify it server-side and mint the app's normal NextAuth session, so
    // the rest of the app (RBAC, `auth()`, sessions) is unchanged.
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: { idToken: {} },
      authorize: async (creds) => {
        const idToken = String(creds?.idToken ?? "");
        if (!idToken) return null;
        let claims;
        try {
          claims = await verifyFirebaseIdToken(idToken);
        } catch {
          return null; // invalid / expired token
        }
        const email = String(claims.email ?? "").toLowerCase().trim();
        if (!email) return null;
        const ip = await getClientIp();
        // Only emails that already exist as an active user may sign in — the
        // app's RBAC roles/scopes stay the source of truth (no auto-provision).
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null; // unknown Google account — nothing to attribute
        return finalizeLogin(user, "GOOGLE", ip);
      },
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const ip = await getClientIp();
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null; // unknown email — nothing to attribute
        if (!user.passwordHash) {
          await logLogin(user.id, "LOGIN_FAILURE", ip, { method: "PASSWORD", reason: "no_password" });
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await logLogin(user.id, "LOGIN_FAILURE", ip, { method: "PASSWORD", reason: "wrong_password" });
          return null;
        }
        return finalizeLogin(user, "PASSWORD", ip);
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      // Both providers' `authorize` return the full DB user, so this is shared.
      if (user) {
        const u = user as { id: string; role: string; roles?: string; scopeEntity?: string | null; scopeDept?: string | null };
        (token as Record<string, unknown>).uid = u.id;
        (token as Record<string, unknown>).role = u.role;
        (token as Record<string, unknown>).roles = u.roles ?? u.role ?? "";
        (token as Record<string, unknown>).scopeEntity = u.scopeEntity ?? null;
        (token as Record<string, unknown>).scopeDept = u.scopeDept ?? null;
      }
      return token;
    },
    session: async ({ session, token }) => {
      const t = token as unknown as { uid: string; role: string; roles: string; scopeEntity?: string | null; scopeDept?: string | null };
      session.user.id = t.uid;
      session.user.role = t.role;
      session.user.roles = t.roles;
      session.user.scopeEntity = t.scopeEntity;
      session.user.scopeDept = t.scopeDept;
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session.user;
}