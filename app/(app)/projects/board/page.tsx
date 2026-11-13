export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditProject, myProjectsFilter, projectVisibilityFilter } from "@/lib/rbac";
import { getScope } from "@/lib/scope";
import { PIPELINE_STAGES, formatDate, projectCode } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { moveProjectStage } from "../actions";
import { Board } from "./board";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const u = session.user;
  const sp = await searchParams;
  const scope = await getScope();

  // Delivered projects only stay on the board for 30 days unless "all" is requested.
  const recent = new Date(Date.now() - 30 * 86400000);
  const projects = await db.project.findMany({
    where: {
      AND: [
        projectVisibilityFilter(u),
        scope === "mine" ? myProjectsFilter(u) : {},
        { stage: { in: [...PIPELINE_STAGES] } },
        sp.all ? {} : { OR: [{ stage: { not: "DELIVERED" } }, { deliveredAt: { gte: recent } }] },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { projectNo: "asc" }],
    include: {
      client: { select: { name: true } },
      editor: { select: { name: true } },
      tasks: { select: { status: true } },
    },
  });

  const cards = projects.map((p) => ({
    id: p.id,
    code: projectCode(p.projectNo),
    title: p.title,
    stage: p.stage,
    priority: p.priority,
    client: p.client?.name ?? null,
    editor: p.editor?.name ?? null,
    due: p.dueDate ? formatDate(p.dueDate) : null,
    isOverdue: p.isOverdue,
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
    tasksTotal: p.tasks.length,
    canMove: canEditProject(u, p),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="page-title">Project Board</h1>
          <p className="page-sub">Drag a card to another column to change its stage. On hold and cancelled projects are in the list view.</p>
        </div>
        <div className="flex gap-2">
          <Link href={sp.all ? "/projects/board" : "/projects/board?all=1"} className="btn-secondary text-xs">{sp.all ? "Hide old deliveries" : "Show all deliveries"}</Link>
          <Link href="/projects/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New Project</Link>
        </div>
      </div>
      <Board cards={cards} stages={[...PIPELINE_STAGES]} move={moveProjectStage} />
    </div>
  );
}
