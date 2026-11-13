import { db } from "@/lib/db";
import { sendNotification } from "@/lib/mailer";
import { PRIORITY_LABELS, STAGE_LABELS, formatDate, projectCode } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────────

async function getProjectOrThrow(projectId: string) {
  return db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      projectNo: true,
      title: true,
      editorId: true,
      reviewerId: true,
      priority: true,
      stage: true,
      dueDate: true,
      reviewComments: true,
      client: { select: { name: true } },
    },
  });
}

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, active: true },
  });
  return user?.active ? user.email : null;
}

function projectUrl(projectId: string): string {
  return `${APP_URL}/projects/${projectId}`;
}

function summary(p: Awaited<ReturnType<typeof getProjectOrThrow>>) {
  return [
    p.client ? `<strong>Client:</strong> ${p.client.name}` : null,
    `<strong>Priority:</strong> ${PRIORITY_LABELS[p.priority] ?? p.priority}`,
    `<strong>Due:</strong> ${formatDate(p.dueDate)}`,
  ]
    .filter(Boolean)
    .join("<br>");
}

async function send(projectId: string, toUserId: string | null | undefined, subject: (code: string) => string, body: string) {
  if (!toUserId) return;
  const [p, email] = await Promise.all([getProjectOrThrow(projectId), getUserEmail(toUserId)]);
  if (!email) return;
  const code = projectCode(p.projectNo);
  await sendNotification({
    to: email,
    subject: subject(code),
    projectCode: code,
    projectName: p.title,
    body: `${body}<br><br>${summary(p)}`,
    actionUrl: projectUrl(projectId),
  });
}

// ── Notification functions ──────────────────────────────────────────────

export async function notifyProjectAssigned(projectId: string, editorId: string): Promise<void> {
  try {
    await send(projectId, editorId, (c) => `${c} assigned to you`, "A project has been assigned to you as the editor.");
  } catch (err) {
    console.error("[notifications] notifyProjectAssigned failed:", err);
  }
}

export async function notifyTaskAssigned(projectId: string, assigneeId: string, taskTitle: string): Promise<void> {
  try {
    await send(projectId, assigneeId, (c) => `New task on ${c}: ${taskTitle}`, `You have been assigned the task <strong>${taskTitle}</strong>.`);
  } catch (err) {
    console.error("[notifications] notifyTaskAssigned failed:", err);
  }
}

export async function notifySubmittedForReview(projectId: string): Promise<void> {
  try {
    const p = await getProjectOrThrow(projectId);
    await send(projectId, p.reviewerId, (c) => `${c} is ready for your review`, "A cut has been submitted and is waiting for your internal review.");
  } catch (err) {
    console.error("[notifications] notifySubmittedForReview failed:", err);
  }
}

export async function notifyReviewOutcome(projectId: string, approved: boolean): Promise<void> {
  try {
    const p = await getProjectOrThrow(projectId);
    const body = approved
      ? "Your cut was approved. The project has moved to final export."
      : `Changes were requested on your cut.${p.reviewComments ? `<br><br><em>${p.reviewComments}</em>` : ""}`;
    await send(projectId, p.editorId, (c) => (approved ? `${c} approved` : `Changes requested on ${c}`), body);
  } catch (err) {
    console.error("[notifications] notifyReviewOutcome failed:", err);
  }
}

export async function notifyOverdue(projectId: string): Promise<void> {
  try {
    const p = await getProjectOrThrow(projectId);
    await send(
      projectId,
      p.editorId,
      (c) => `${c} is overdue`,
      `This project has passed its due date and is still in <strong>${STAGE_LABELS[p.stage] ?? p.stage}</strong>.`,
    );
  } catch (err) {
    console.error("[notifications] notifyOverdue failed:", err);
  }
}
