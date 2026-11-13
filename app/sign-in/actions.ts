"use server";

import { db } from "@/lib/db";
import { verifyFirebaseIdToken } from "@/lib/firebase-verify";

export type AccessRequestResult = {
  status: "submitted" | "already_pending" | "exists_active" | "exists_inactive" | "error";
  message: string;
};

/**
 * Called after a successful Google (Firebase) popup when the normal sign-in was
 * refused. Verifies the Firebase ID token server-side and, if the email has no
 * account, files a PENDING access request for an admin to review. Never grants
 * access — that only happens on admin approval.
 */
export async function submitGoogleAccessRequest(idToken: string): Promise<AccessRequestResult> {
  let claims;
  try {
    claims = await verifyFirebaseIdToken(idToken);
  } catch {
    return { status: "error", message: "We couldn't verify your Google sign-in. Please try again." };
  }

  const email = String(claims.email ?? "").toLowerCase().trim();
  const name = (String(claims.name ?? "").trim() || email.split("@")[0]) as string;
  const firebaseUid = claims.sub;
  if (!email) {
    return { status: "error", message: "Your Google account didn't return an email address." };
  }

  // Already has an account? Don't create a request — report their account state.
  const user = await db.user.findUnique({ where: { email }, select: { active: true } });
  if (user) {
    if (user.active) {
      return { status: "exists_active", message: "Your account is already active — please try signing in again." };
    }
    return {
      status: "exists_inactive",
      message: "Your account exists but isn't active yet. Please contact an administrator.",
    };
  }

  // Existing pending request → don't duplicate (no duplicate requests).
  const existing = await db.userRequest.findUnique({ where: { email } });
  if (existing && existing.status === "PENDING") {
    return {
      status: "already_pending",
      message: "You already have a pending request. An administrator will review it shortly.",
    };
  }

  // New request, or re-opening a previously reviewed one.
  await db.userRequest.upsert({
    where: { email },
    update: {
      name,
      firebaseUid,
      loginMethod: "GOOGLE",
      status: "PENDING",
      note: null,
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedById: null,
    },
    create: { name, email, firebaseUid, loginMethod: "GOOGLE", status: "PENDING" },
  });

  return {
    status: "submitted",
    message: "Your access request has been submitted. An administrator will review it shortly.",
  };
}