"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can, type SessionUser } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const VALID_ROLES = ["ADMIN", "EDITOR", "REVIEWER"];

async function requireApprover(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user || !can(s.user, "request:manage")) throw new Error("FORBIDDEN");
  return s.user;
}

/** Approve a pending request: create the user (active, chosen roles), mark the
 *  request approved — atomically, so concurrent approvals can't double-create. */
export async function approveRequest(formData: FormData) {
  const admin = await requireApprover();
  const id = String(formData.get("id") ?? "");
  const rolesArr = formData.getAll("roles").map(String).map((r) => r.trim()).filter(Boolean);
  const scopeEntity = String(formData.get("scopeEntity") ?? "").trim() || null;
  const scopeDept = String(formData.get("scopeDept") ?? "").trim() || null;
  if (!id) throw new Error("BAD_REQUEST");
  if (rolesArr.length === 0) throw new Error("Select at least one role.");
  if (rolesArr.some((r) => !VALID_ROLES.includes(r))) throw new Error("Invalid role");
  const roles = rolesArr.join(",");
  const role = rolesArr[0]; // primary role for backward compat

  const outcome = await db.$transaction(async (tx) => {
    const req = await tx.userRequest.findUnique({ where: { id } });
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "PENDING") throw new Error("This request has already been reviewed.");

    const existing = await tx.user.findUnique({ where: { email: req.email } });
    if (existing) {
      // Already a user (created out-of-band) — reactivate rather than duplicate.
      await tx.user.update({ where: { id: existing.id }, data: { active: true } });
      await tx.userRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: admin.id },
      });
      return { userId: existing.id, email: req.email, created: false };
    }

    const user = await tx.user.create({
      data: {
        email: req.email,
        name: req.name,
        role,
        roles,
        scopeEntity,
        scopeDept,
        active: true,
        mustSetup: true, // first login → set up profile + password
        createdById: admin.id,
        // passwordHash stays null until they complete setup.
      },
    });
    await tx.userRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: admin.id },
    });
    return { userId: user.id, email: req.email, created: true };
  });

  await recordAudit({
    entity: "User",
    entityId: outcome.userId,
    projectId: null,
    action: "USER_APPROVED",
    diff: { email: { before: null, after: outcome.email }, roles: { before: null, after: roles } },
    userId: admin.id,
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin/users");
  revalidatePath("/sign-in");
}

/** Reject a pending request. Records an optional reason. */
export async function rejectRequest(formData: FormData) {
  const admin = await requireApprover();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) throw new Error("BAD_REQUEST");

  const req = await db.userRequest.findUnique({ where: { id } });
  if (!req) throw new Error("NOT_FOUND");
  if (req.status !== "PENDING") throw new Error("This request has already been reviewed.");

  await db.userRequest.update({
    where: { id },
    data: { status: "REJECTED", note, reviewedAt: new Date(), reviewedById: admin.id },
  });

  await recordAudit({
    entity: "UserRequest",
    entityId: id,
    projectId: null,
    action: "USER_REJECTED",
    diff: { email: { before: req.email, after: req.email }, status: { before: "PENDING", after: "REJECTED" } },
    userId: admin.id,
  });

  revalidatePath("/admin/requests");
}