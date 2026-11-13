"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

async function ensure() {
  const s = await auth();
  if (!s?.user || !can(s.user, "lookup:manage")) throw new Error("FORBIDDEN");
}

export async function addProjectType(formData: FormData) {
  await ensure();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("BAD_REQUEST");
  await db.projectType.upsert({ where: { name }, create: { name }, update: {} });
  revalidatePath("/admin/lookups");
}

export async function deleteProjectType(formData: FormData) {
  await ensure();
  const id = String(formData.get("id") ?? "");
  const count = await db.project.count({ where: { projectTypeId: id } });
  if (count > 0) return;
  await db.projectType.delete({ where: { id } });
  revalidatePath("/admin/lookups");
}
