"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const s = await auth();
  if (!s?.user || !can(s.user, "user:manage")) throw new Error("FORBIDDEN");
  return s.user;
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");
  const rolesArr = formData.getAll("roles").map(String).filter(Boolean);
  const roles = rolesArr.join(",") || "EDITOR";
  const role = rolesArr[0] || "EDITOR"; // primary role for backward compat
  const scopeEntity = String(formData.get("scopeEntity") ?? "") || null;
  const scopeDept = String(formData.get("scopeDept") ?? "") || null;
  if (!email || !name || !password) throw new Error("BAD_REQUEST");
  await db.user.create({
    data: {
      email, name, role, roles, scopeEntity, scopeDept,
      passwordHash: bcrypt.hashSync(password, 10),
    },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRoles(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const rolesArr = formData.getAll("roles").map(String).filter(Boolean);
  const roles = rolesArr.join(",") || "EDITOR";
  const role = rolesArr[0] || "EDITOR";
  if (!id) throw new Error("BAD_REQUEST");
  await db.user.update({ where: { id }, data: { role, roles } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const u = await db.user.findUnique({ where: { id } });
  if (!u) throw new Error("NOT_FOUND");
  await db.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function resolvePasswordReset(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!requestId || !newPassword) throw new Error("BAD_REQUEST");

  const req = await db.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") throw new Error("NOT_FOUND");

  await db.$transaction([
    db.user.update({
      where: { id: req.userId },
      data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
    }),
    db.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: admin.id },
    }),
  ]);
  revalidatePath("/admin/users");
}

export async function dismissPasswordReset(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) throw new Error("BAD_REQUEST");

  await db.passwordResetRequest.update({
    where: { id: requestId },
    data: { status: "DISMISSED", resolvedAt: new Date(), resolvedById: admin.id },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("BAD_REQUEST");
  if (id === admin.id) throw new Error("Cannot delete yourself");

  const u = await db.user.findUnique({
    where: { id },
    include: {
      _count: { select: { editedProjects: true, createdProjects: true } },
    },
  });
  if (!u) throw new Error("NOT_FOUND");

  if (u._count.editedProjects > 0 || u._count.createdProjects > 0) {
    throw new Error(
      "Cannot delete user with associated projects. Reassign their projects first, or deactivate the user instead."
    );
  }

  await db.auditLog.deleteMany({ where: { userId: id } });
  await db.projectAsset.deleteMany({ where: { uploadedById: id } });
  await db.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  revalidatePath("/sign-in");
}
