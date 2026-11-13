export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { projectVisibilityFilter } from "@/lib/rbac";
import { db } from "@/lib/db";
import { monthLabel, toInputDate } from "@/lib/utils";
import { AnalyticsBuilder } from "./builder";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const projects = await db.project.findMany({
    where: projectVisibilityFilter(session.user),
    include: {
      client: { select: { name: true } },
      projectType: { select: { name: true } },
      editor: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  });

  const data = projects.map((p) => ({
    priority: p.priority,
    status: p.stage,
    client: p.client?.name ?? "\u2014",
    projectType: p.projectType?.name ?? "\u2014",
    month: monthLabel(p.receivedDate),
    source: p.source ?? "\u2014",
    editor: p.editor?.name ?? "Unassigned",
    reviewer: p.reviewer?.name ?? "Unassigned",
    overdue: p.isOverdue ? "Yes" : "No",
    revisions: String(p.revisionCount),
    turnaroundDays: p.turnaroundDays ?? 0,
    daysOpen: p.daysOpen ?? 0,
    receivedDate: toInputDate(p.receivedDate),
    deliveredDate: p.deliveredAt ? toInputDate(p.deliveredAt) : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Custom Analytics</h1>
        <p className="page-sub">Build custom charts and pivot views from project data.</p>
      </div>
      <AnalyticsBuilder data={data} />
    </div>
  );
}
