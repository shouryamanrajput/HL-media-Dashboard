"use server";

import * as XLSX from "xlsx";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { computeDeadline } from "@/lib/deadlines";
import { IMPORT_COLUMNS, type ImportKey } from "@/lib/import-template";
import { PRIORITY_LIST, STAGE_LIST, STAGE_LABELS } from "@/lib/utils";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_MAP = new Map<string, ImportKey>(IMPORT_COLUMNS.map((c) => [norm(c.header), c.key]));

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(d.y, d.m - 1, d.d) : null;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function parseStage(v: string): string | null {
  if (!v) return null;
  const n = norm(v);
  return STAGE_LIST.find((s) => norm(s) === n || norm(STAGE_LABELS[s]) === n) ?? null;
}

export async function importExcel(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const u = session.user;
  if (!can(u, "project:import")) redirect("/import?err=forbidden");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/import?err=no-file");

  let inserted = 0;
  let updated = 0;
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (raw.length === 0) throw new Error("The first sheet has no data rows.");

    const users = await db.user.findMany({ select: { id: true, email: true } });
    const userByEmail = new Map(users.map((x) => [x.email.toLowerCase(), x.id]));
    const clientCache = new Map<string, string>();
    const typeCache = new Map<string, string>();
    let nextNo = ((await db.project.aggregate({ _max: { projectNo: true } }))._max.projectNo ?? 0) + 1;
    const errors: string[] = [];

    for (const [i, r] of raw.entries()) {
      const row: Partial<Record<ImportKey, unknown>> = {};
      for (const [h, v] of Object.entries(r)) {
        const key = HEADER_MAP.get(norm(h));
        if (key) row[key] = typeof v === "string" ? v.trim() : v;
      }
      const line = i + 2;
      const title = String(row.title ?? "");
      const clientName = String(row.client ?? "");
      if (!title && !clientName) continue;
      if (!title || !clientName) { errors.push(`Row ${line}: Title and Client are required`); continue; }

      let clientId = clientCache.get(clientName.toLowerCase());
      if (!clientId) {
        clientId = (await db.client.upsert({ where: { name: clientName }, update: {}, create: { name: clientName } })).id;
        clientCache.set(clientName.toLowerCase(), clientId);
      }
      let projectTypeId: string | null = null;
      const typeName = String(row.projectType ?? "");
      if (typeName) {
        projectTypeId = typeCache.get(typeName.toLowerCase()) ?? null;
        if (!projectTypeId) {
          projectTypeId = (await db.projectType.upsert({ where: { name: typeName }, update: {}, create: { name: typeName } })).id;
          typeCache.set(typeName.toLowerCase(), projectTypeId);
        }
      }

      const priority = String(row.priority ?? "").toUpperCase();
      const stage = parseStage(String(row.stage ?? "")) ?? "BRIEF";
      const receivedDate = parseDate(row.receivedDate) ?? new Date();
      const dueDate = parseDate(row.dueDate);
      const deliveredAt = parseDate(row.deliveredAt) ?? (stage === "DELIVERED" ? new Date() : null);
      const editorEmail = String(row.editorEmail ?? "").toLowerCase();
      const reviewerEmail = String(row.reviewerEmail ?? "").toLowerCase();
      if (editorEmail && !userByEmail.has(editorEmail)) errors.push(`Row ${line}: unknown editor ${editorEmail} (left unassigned)`);

      const data = {
        title,
        brief: String(row.brief ?? "") || null,
        source: String(row.source ?? "") || null,
        priority: (PRIORITY_LIST as readonly string[]).includes(priority) ? priority : "MEDIUM",
        stage,
        clientId,
        projectTypeId,
        editorId: userByEmail.get(editorEmail) ?? null,
        reviewerId: userByEmail.get(reviewerEmail) ?? null,
        receivedDate,
        startDate: parseDate(row.startDate),
        dueDate,
        deliveredAt,
        revisionCount: Number(row.revisionCount) || 0,
        finalLink: String(row.finalLink ?? "") || null,
        ...computeDeadline({ receivedDate, dueDate, deliveredAt, stage }),
      };

      const no = Number(String(row.projectNo ?? "").replace(/\D/g, "")) || null;
      const existing = no ? await db.project.findUnique({ where: { projectNo: no }, select: { id: true } }) : null;
      if (existing) {
        await db.project.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        const projectNo = no ?? nextNo++;
        if (projectNo >= nextNo) nextNo = projectNo + 1;
        await db.project.create({ data: { ...data, projectNo, createdById: u.id } });
        inserted++;
      }
    }

    await recordAudit({ entity: "Import", entityId: file.name, action: "IMPORT", diff: { inserted, updated, warnings: errors.slice(0, 20) }, userId: u.id });
    revalidatePath("/projects");
    if (errors.length && inserted + updated === 0) throw new Error(errors.slice(0, 5).join("; "));
    const warn = errors.length ? `&warn=${encodeURIComponent(errors.slice(0, 5).join("; "))}` : "";
    redirect(`/import?ok=1&n=${inserted}&u=${updated}${warn}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : "Unknown error";
    redirect(`/import?err=${encodeURIComponent(msg)}`);
  }
}
