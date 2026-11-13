"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function requireClientManager() {
  const s = await auth();
  if (!s?.user) throw new Error("UNAUTHENTICATED");
  if (!can(s.user, "client:manage")) throw new Error("FORBIDDEN");
  return s.user;
}

function fields(fd: FormData) {
  const v = (k: string) => String(fd.get(k) ?? "").trim() || null;
  return { name: v("name"), contactName: v("contactName"), email: v("email"), phone: v("phone"), notes: v("notes") };
}

export async function saveClient(formData: FormData) {
  const u = await requireClientManager();
  const id = String(formData.get("id") ?? "");
  const data = fields(formData);
  if (!data.name) throw new Error("Client name is required.");
  const client = id
    ? await db.client.update({ where: { id }, data: { ...data, name: data.name } })
    : await db.client.create({ data: { ...data, name: data.name } });
  await recordAudit({ entity: "Client", entityId: client.id, action: id ? "UPDATE" : "CREATE", diff: { name: { before: null, after: client.name } }, userId: u.id });
  revalidatePath("/clients");
}

export async function deleteClient(formData: FormData) {
  const u = await requireClientManager();
  const id = String(formData.get("id") ?? "");
  const count = await db.project.count({ where: { clientId: id } });
  if (count > 0) throw new Error("This client has projects. Reassign or delete them first.");
  const client = await db.client.delete({ where: { id } });
  await recordAudit({ entity: "Client", entityId: id, action: "DELETE", diff: { name: { before: client.name, after: null } }, userId: u.id });
  revalidatePath("/clients");
}
