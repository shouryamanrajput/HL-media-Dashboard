"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import path from "node:path";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can, canEditProject, canViewProject, myProjectsFilter, projectVisibilityFilter, type SessionUser } from "@/lib/rbac";
import { computeDeadline } from "@/lib/deadlines";
import { buildDiff, recordAudit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { STAGE_LIST, TASK_STATUS_LIST, DELIVERABLE_STATUS_LIST, ASSET_KIND_LIST } from "@/lib/utils";
import { notifyProjectAssigned, notifyTaskAssigned, notifySubmittedForReview, notifyReviewOutcome } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function user(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user) throw new Error("UNAUTHENTICATED");
  return s.user;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadProject(id: string) {
  const p = await db.project.findUnique({ where: { id }, include: { tasks: { select: { assigneeId: true } } } });
  if (!p) throw new Error("NOT_FOUND");
  return p;
}

async function requireView(u: SessionUser, projectId: string) {
  const p = await loadProject(projectId);
  if (!can(u, "project:view") || !canViewProject(u, p)) throw new Error("FORBIDDEN");
  return p;
}

async function requireEdit(u: SessionUser, projectId: string) {
  const p = await loadProject(projectId);
  if (!canEditProject(u, p)) throw new Error("FORBIDDEN");
  return p;
}

function refresh(projectId?: string) {
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/projects/board");
}

/** Find or create the client chosen on a form (existing id, or a new name). */
async function resolveClientId(fd: FormData): Promise<string | null> {
  const newName = str(fd, "newClientName");
  if (newName) {
    const c = await db.client.upsert({ where: { name: newName }, create: { name: newName }, update: {} });
    return c.id;
  }
  return str(fd, "clientId");
}

/** Stage side effects: start/delivery timestamps and recomputed deadline fields. */
function stageEffects(
  existing: { stage: string; startDate: Date | null; deliveredAt: Date | null; receivedDate: Date; dueDate: Date | null },
  next: { stage?: string; receivedDate?: Date | null; dueDate?: Date | null },
) {
  const stage = next.stage ?? existing.stage;
  const data: Record<string, unknown> = {};
  if (stage === "EDITING" && !existing.startDate) data.startDate = new Date();
  let deliveredAt = existing.deliveredAt;
  if (stage === "DELIVERED" && !deliveredAt) deliveredAt = data.deliveredAt = new Date();
  if (stage !== "DELIVERED" && deliveredAt) deliveredAt = data.deliveredAt = null;
  const d = computeDeadline({
    receivedDate: next.receivedDate ?? existing.receivedDate,
    dueDate: next.dueDate !== undefined ? next.dueDate : existing.dueDate,
    deliveredAt,
    stage,
  });
  data.daysOpen = d.daysOpen;
  data.turnaroundDays = d.turnaroundDays;
  data.isOverdue = d.isOverdue;
  return data;
}

// ── Projects ────────────────────────────────────────────────────────────

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const projectSchema = z.object({
  title: z.string().min(1, "Title"),
  brief: z.string().optional().nullable(),
  projectTypeId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES),
  editorId: z.string().optional().nullable(),
  reviewerId: z.string().optional().nullable(),
  receivedDate: z.string().min(1, "Received date"),
  dueDate: z.string().optional().nullable(),
});

export async function createProject(formData: FormData) {
  const u = await user();
  if (!can(u, "project:create")) throw new Error("You don't have permission to create projects.");
  if (!(await db.user.findUnique({ where: { id: u.id } }))) throw new Error("Your session is stale. Please sign out and sign back in.");

  const result = projectSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((i) => i.message || String(i.path[0])))];
    throw new Error(`Please fill the required fields: ${missing.join(", ")}`);
  }
  const p = result.data;
  const receivedDate = toDate(p.receivedDate) ?? new Date();
  const dueDate = toDate(p.dueDate);
  const clientId = await resolveClientId(formData);
  const d = computeDeadline({ receivedDate, dueDate, stage: "BRIEF" });

  let created: Awaited<ReturnType<typeof db.project.create>> | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.$transaction(async (tx) => {
        const max = await tx.project.aggregate({ _max: { projectNo: true } });
        return tx.project.create({
          data: {
            projectNo: (max._max.projectNo ?? 0) + 1,
            title: p.title,
            brief: p.brief || null,
            clientId,
            projectTypeId: p.projectTypeId || null,
            source: p.source || null,
            priority: p.priority,
            editorId: p.editorId || null,
            reviewerId: p.reviewerId || null,
            receivedDate,
            dueDate,
            daysOpen: d.daysOpen,
            isOverdue: d.isOverdue,
            createdById: u.id,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  if (!created) throw new Error("Failed to create project.");

  await recordAudit({
    entity: "Project",
    entityId: created.id,
    projectId: created.id,
    action: "CREATE",
    diff: { projectNo: { before: null, after: created.projectNo } },
    userId: u.id,
  });
  if (created.editorId) notifyProjectAssigned(created.id, created.editorId).catch(() => {});

  refresh();
  redirect(`/projects/${created.id}`);
}

export async function updateProject(formData: FormData) {
  const u = await user();
  const id = String(formData.get("id") ?? "");
  const existing = await requireEdit(u, id);

  const data: Record<string, unknown> = {};
  const textFields = ["title", "brief", "projectTypeId", "source", "reviewerId", "finalLink", "deliveryNotes", "overdueReason"];
  for (const k of textFields) if (formData.has(k)) data[k] = str(formData, k);
  if (formData.has("title") && !data.title) throw new Error("Title is required.");
  if (formData.has("priority")) data.priority = z.enum(PRIORITIES).parse(formData.get("priority"));
  if (formData.has("stage")) data.stage = z.enum(STAGE_LIST).parse(formData.get("stage"));
  if (formData.has("clientId") || formData.has("newClientName")) data.clientId = await resolveClientId(formData);
  for (const k of ["receivedDate", "dueDate"]) if (formData.has(k)) data[k] = toDate(formData.get(k));
  if (data.receivedDate === null) delete data.receivedDate;

  Object.assign(data, stageEffects(existing, {
    stage: data.stage as string | undefined,
    receivedDate: data.receivedDate as Date | undefined,
    dueDate: data.dueDate as Date | null | undefined,
  }));

  const updated = await db.project.update({ where: { id }, data });
  const { tasks: _tasks, ...before } = existing;
  const diff = buildDiff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
  for (const k of ["updatedAt", "daysOpen"]) delete diff[k];
  if (Object.keys(diff).length) {
    await recordAudit({
      entity: "Project",
      entityId: id,
      projectId: id,
      action: existing.stage !== updated.stage ? "STAGE_CHANGE" : "UPDATE",
      diff,
      userId: u.id,
    });
  }

  refresh(id);
  redirect(`/projects/${id}?saved=1`);
}

/** Used by the board: move a project to another stage without leaving the page. */
export async function moveProjectStage(id: string, stage: string) {
  const u = await user();
  const existing = await requireEdit(u, id);
  const nextStage = z.enum(STAGE_LIST).parse(stage);
  if (existing.stage === nextStage) return;
  await db.project.update({ where: { id }, data: { stage: nextStage, ...stageEffects(existing, { stage: nextStage }) } });
  await recordAudit({
    entity: "Project",
    entityId: id,
    projectId: id,
    action: "STAGE_CHANGE",
    diff: { stage: { before: existing.stage, after: nextStage } },
    userId: u.id,
  });
  refresh(id);
}

export async function assignProject(formData: FormData) {
  const u = await user();
  if (!can(u, "project:assign")) throw new Error("FORBIDDEN");
  const id = String(formData.get("id") ?? "");
  const editorId = str(formData, "editorId");
  const existing = await loadProject(id);
  await db.project.update({ where: { id }, data: { editorId } });
  await recordAudit({
    entity: "Project",
    entityId: id,
    projectId: id,
    action: "ASSIGN",
    diff: { editorId: { before: existing.editorId, after: editorId } },
    userId: u.id,
  });
  if (editorId && editorId !== existing.editorId) notifyProjectAssigned(id, editorId).catch(() => {});
  refresh(id);
  redirect(`/projects/${id}?assigned=1`);
}

export async function submitForReview(formData: FormData) {
  const u = await user();
  if (!can(u, "project:submit-for-review")) throw new Error("FORBIDDEN");
  const id = String(formData.get("id") ?? "");
  const reviewerId = str(formData, "reviewerId");
  if (!reviewerId) throw new Error("Please choose a reviewer.");
  const existing = await requireEdit(u, id);
  await db.project.update({
    where: { id },
    data: { stage: "INTERNAL_REVIEW", reviewerId, submittedForReviewAt: new Date(), reviewStatus: null, ...stageEffects(existing, { stage: "INTERNAL_REVIEW" }) },
  });
  await recordAudit({
    entity: "Project",
    entityId: id,
    projectId: id,
    action: "STAGE_CHANGE",
    diff: { stage: { before: existing.stage, after: "INTERNAL_REVIEW" }, reviewerId: { before: existing.reviewerId, after: reviewerId } },
    userId: u.id,
  });
  notifySubmittedForReview(id).catch(() => {});
  refresh(id);
  redirect(`/projects/${id}?submitted=1`);
}

export async function reviewProject(formData: FormData) {
  const u = await user();
  if (!can(u, "project:review")) throw new Error("FORBIDDEN");
  const id = String(formData.get("id") ?? "");
  const decision = z.enum(["APPROVED", "CHANGES_REQUESTED"]).parse(formData.get("decision"));
  const comments = str(formData, "comments");
  const existing = await loadProject(id);
  if (existing.stage !== "INTERNAL_REVIEW") throw new Error("This project is not waiting for review.");
  if (decision === "CHANGES_REQUESTED" && !comments) throw new Error("Please describe the changes you need.");

  const stage = decision === "APPROVED" ? "FINAL_EXPORT" : "REVISIONS";
  await db.project.update({
    where: { id },
    data: {
      stage,
      reviewStatus: decision,
      reviewComments: comments,
      reviewedAt: new Date(),
      reviewerId: existing.reviewerId ?? u.id,
      revisionCount: decision === "CHANGES_REQUESTED" ? { increment: 1 } : undefined,
      ...stageEffects(existing, { stage }),
    },
  });
  await recordAudit({
    entity: "Project",
    entityId: id,
    projectId: id,
    action: "REVIEW",
    diff: {
      reviewStatus: { before: existing.reviewStatus, after: decision },
      stage: { before: existing.stage, after: stage },
      ...(comments ? { reviewComments: { before: existing.reviewComments, after: comments } } : {}),
    },
    userId: u.id,
  });
  notifyReviewOutcome(id, decision === "APPROVED").catch(() => {});
  refresh(id);
  revalidatePath("/reviews");
  redirect(`/projects/${id}?reviewed=1`);
}

export async function deleteProject(formData: FormData) {
  const u = await user();
  if (!can(u, "project:delete")) throw new Error("FORBIDDEN");
  const id = String(formData.get("id") ?? "");
  const p = await db.project.delete({ where: { id } });
  await recordAudit({
    entity: "Project",
    entityId: id,
    action: "DELETE",
    diff: { projectNo: { before: p.projectNo, after: null }, title: { before: p.title, after: null } },
    userId: u.id,
  });
  refresh();
  redirect("/projects?deleted=1");
}

// ── Tasks ───────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const u = await user();
  if (!can(u, "task:create")) throw new Error("FORBIDDEN");
  const projectId = String(formData.get("projectId") ?? "");
  await requireView(u, projectId);
  const title = str(formData, "title");
  if (!title) throw new Error("Task title is required.");
  const assigneeId = str(formData, "assigneeId");
  const task = await db.task.create({
    data: {
      projectId,
      title,
      description: str(formData, "description"),
      assigneeId,
      dueDate: toDate(formData.get("dueDate")),
      estimateHours: num(formData, "estimateHours"),
      createdById: u.id,
    },
  });
  await recordAudit({ entity: "Task", entityId: task.id, projectId, action: "CREATE", diff: { task: { before: null, after: title } }, userId: u.id });
  if (assigneeId && assigneeId !== u.id) notifyTaskAssigned(projectId, assigneeId, title).catch(() => {});
  refresh(projectId);
  revalidatePath("/tasks");
}

/** Assignee, project editor or admin may update a task. */
async function requireTaskEdit(u: SessionUser, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId }, include: { project: { select: { editorId: true } } } });
  if (!task) throw new Error("NOT_FOUND");
  if (!(can(u, "task:edit-any") || task.assigneeId === u.id || task.project.editorId === u.id)) throw new Error("FORBIDDEN");
  return task;
}

export async function updateTask(formData: FormData) {
  const u = await user();
  const task = await requireTaskEdit(u, String(formData.get("id") ?? ""));
  const data: Record<string, unknown> = {};
  if (formData.has("status")) {
    const status = z.enum(TASK_STATUS_LIST).parse(formData.get("status"));
    data.status = status;
    data.completedAt = status === "DONE" ? task.completedAt ?? new Date() : null;
  }
  if (formData.has("assigneeId")) data.assigneeId = str(formData, "assigneeId");
  if (formData.has("dueDate")) data.dueDate = toDate(formData.get("dueDate"));
  const addHours = num(formData, "addHours");
  if (addHours) data.loggedHours = Math.max(0, task.loggedHours + addHours);

  const updated = await db.task.update({ where: { id: task.id }, data });
  const diff = buildDiff(task as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
  delete diff.updatedAt;
  delete diff.project;
  if (Object.keys(diff).length) {
    await recordAudit({ entity: "Task", entityId: task.id, projectId: task.projectId, action: "UPDATE", diff: { task: { before: null, after: task.title }, ...diff }, userId: u.id });
  }
  if (updated.assigneeId && updated.assigneeId !== task.assigneeId && updated.assigneeId !== u.id) {
    notifyTaskAssigned(task.projectId, updated.assigneeId, task.title).catch(() => {});
  }
  refresh(task.projectId);
  revalidatePath("/tasks");
}

export async function deleteTask(formData: FormData) {
  const u = await user();
  const task = await requireTaskEdit(u, String(formData.get("id") ?? ""));
  await db.task.delete({ where: { id: task.id } });
  await recordAudit({ entity: "Task", entityId: task.id, projectId: task.projectId, action: "DELETE", diff: { task: { before: task.title, after: null } }, userId: u.id });
  refresh(task.projectId);
  revalidatePath("/tasks");
}

// ── Deliverables ────────────────────────────────────────────────────────

export async function addDeliverable(formData: FormData) {
  const u = await user();
  const projectId = String(formData.get("projectId") ?? "");
  await requireView(u, projectId);
  const name = str(formData, "name");
  if (!name) throw new Error("Deliverable name is required.");
  const minutes = num(formData, "durationMin") ?? 0;
  const seconds = num(formData, "durationSecPart") ?? 0;
  const d = await db.deliverable.create({
    data: {
      projectId,
      name,
      platform: str(formData, "platform"),
      aspectRatio: str(formData, "aspectRatio"),
      durationSec: minutes || seconds ? Math.round(minutes * 60 + seconds) : null,
      link: str(formData, "link"),
    },
  });
  await recordAudit({ entity: "Deliverable", entityId: d.id, projectId, action: "CREATE", diff: { deliverable: { before: null, after: name } }, userId: u.id });
  refresh(projectId);
}

export async function updateDeliverable(formData: FormData) {
  const u = await user();
  const id = String(formData.get("id") ?? "");
  const d = await db.deliverable.findUnique({ where: { id } });
  if (!d) throw new Error("NOT_FOUND");
  await requireView(u, d.projectId);
  const data: Record<string, unknown> = {};
  if (formData.has("status")) data.status = z.enum(DELIVERABLE_STATUS_LIST).parse(formData.get("status"));
  if (formData.has("link")) data.link = str(formData, "link");
  await db.deliverable.update({ where: { id }, data });
  await recordAudit({ entity: "Deliverable", entityId: id, projectId: d.projectId, action: "UPDATE", diff: { deliverable: { before: null, after: d.name }, ...(data.status ? { status: { before: d.status, after: data.status } } : {}) }, userId: u.id });
  refresh(d.projectId);
}

export async function deleteDeliverable(formData: FormData) {
  const u = await user();
  const id = String(formData.get("id") ?? "");
  const d = await db.deliverable.findUnique({ where: { id } });
  if (!d) throw new Error("NOT_FOUND");
  await requireEdit(u, d.projectId);
  await db.deliverable.delete({ where: { id } });
  await recordAudit({ entity: "Deliverable", entityId: id, projectId: d.projectId, action: "DELETE", diff: { deliverable: { before: d.name, after: null } }, userId: u.id });
  refresh(d.projectId);
}

// ── Assets (links or uploads) ───────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function addAsset(formData: FormData) {
  const u = await user();
  const projectId = String(formData.get("projectId") ?? "");
  await requireView(u, projectId);
  const kind = z.enum(ASSET_KIND_LIST).parse(formData.get("kind") ?? "OTHER");
  const url = str(formData, "url");
  const file = formData.get("file") as File | null;
  const hasFile = !!file && file.size > 0;
  if (!url && !hasFile) throw new Error("Paste a link or choose a file.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Links must start with http:// or https://");
  if (hasFile && file.size > MAX_FILE_SIZE) throw new Error("File too large (max 50 MB). Paste a Frame.io / Drive / Dropbox link for big videos.");

  let upload: { filename: string; storageKey: string; mimeType: string; size: number } | null = null;
  if (hasFile) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = path.posix.join(projectId, `${Date.now()}-${safe}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await storage.upload(storageKey, buf, file.type || "application/octet-stream");
    upload = { filename: file.name, storageKey, mimeType: file.type || "application/octet-stream", size: buf.byteLength };
  }

  const prevVersion = await db.projectAsset.aggregate({ where: { projectId, kind }, _max: { version: true } });
  const asset = await db.projectAsset.create({
    data: {
      projectId,
      kind,
      label: str(formData, "label") ?? upload?.filename ?? url!,
      version: kind === "DRAFT" || kind === "FINAL" ? (prevVersion._max.version ?? 0) + 1 : null,
      url,
      ...upload,
      uploadedById: u.id,
    },
  });
  await recordAudit({ entity: "ProjectAsset", entityId: asset.id, projectId, action: "FILE_UPLOAD", diff: { asset: { before: null, after: asset.label } }, userId: u.id });
  refresh(projectId);
}

export async function deleteAsset(formData: FormData) {
  const u = await user();
  const id = String(formData.get("id") ?? "");
  const asset = await db.projectAsset.findUnique({ where: { id } });
  if (!asset) throw new Error("NOT_FOUND");
  const p = await loadProject(asset.projectId);
  if (!(canEditProject(u, p) || asset.uploadedById === u.id)) throw new Error("FORBIDDEN");
  await db.projectAsset.delete({ where: { id } });
  if (asset.storageKey) await storage.delete(asset.storageKey).catch(() => {});
  await recordAudit({ entity: "ProjectAsset", entityId: id, projectId: asset.projectId, action: "DELETE", diff: { asset: { before: asset.label, after: null } }, userId: u.id });
  refresh(asset.projectId);
}

// ── Comments ────────────────────────────────────────────────────────────

export async function addComment(formData: FormData) {
  const u = await user();
  const projectId = String(formData.get("projectId") ?? "");
  await requireView(u, projectId);
  const body = str(formData, "body");
  if (!body) return;
  await db.comment.create({ data: { projectId, taskId: str(formData, "taskId"), userId: u.id, body } });
  refresh(projectId);
}

// ── Listing ─────────────────────────────────────────────────────────────

const SORTABLE_FIELDS = ["projectNo", "dueDate", "priority", "stage", "receivedDate"] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

function parseSortParam(sort?: string): { field: SortField; dir: "asc" | "desc" } | null {
  if (!sort) return null;
  const [field, dir] = sort.split(":");
  if (!SORTABLE_FIELDS.includes(field as SortField)) return null;
  if (dir !== "asc" && dir !== "desc") return null;
  return { field: field as SortField, dir };
}

export async function listVisibleProjects(
  scope: "mine" | "all" = "mine",
  opts: { page?: number; pageSize?: number; sort?: string; q?: string; priority?: string; stage?: string; client?: string; editor?: string; overdue?: string; open?: string } = {},
) {
  const u = await user();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 25));

  const filters: Prisma.ProjectWhereInput[] = [projectVisibilityFilter(u)];
  if (scope === "mine") filters.push(myProjectsFilter(u));
  if (opts.q) {
    const q = opts.q.replace(/^hlm-0*/i, "");
    filters.push({
      OR: [
        { projectNo: { equals: parseInt(q) || -1 } },
        { title: { contains: opts.q } },
        { client: { name: { contains: opts.q } } },
      ],
    });
  }
  if (opts.priority) filters.push({ priority: opts.priority });
  if (opts.stage) filters.push({ stage: opts.stage });
  if (opts.client) filters.push({ clientId: opts.client });
  if (opts.editor) filters.push({ editorId: opts.editor });
  if (opts.overdue === "1") filters.push({ isOverdue: true });
  if (opts.open === "1") filters.push({ stage: { notIn: ["DELIVERED", "CANCELLED"] } });

  const where: Prisma.ProjectWhereInput = { AND: filters };
  const sortParsed = parseSortParam(opts.sort);
  const orderBy = sortParsed ? { [sortParsed.field]: sortParsed.dir } : { createdAt: "desc" as const };

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        editor: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        projectType: { select: { name: true } },
        tasks: { select: { status: true } },
      },
    }),
    db.project.count({ where }),
  ]);

  return { projects, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
