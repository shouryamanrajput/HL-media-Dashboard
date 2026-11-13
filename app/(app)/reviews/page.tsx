import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can, hasRole } from "@/lib/rbac";
import { formatDate, priorityColor, PRIORITY_LABELS, projectCode } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { DueCell } from "@/components/due-cell";

export default async function ReviewQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const u = session.user;
  if (!can(u, "project:review")) {
    return <div className="card p-6 text-ink-500">You don&apos;t have reviewer access.</div>;
  }

  const isAdmin = hasRole(u, "ADMIN");
  const pending = await db.project.findMany({
    where: { stage: "INTERNAL_REVIEW", ...(isAdmin ? {} : { OR: [{ reviewerId: u.id }, { reviewerId: null }] }) },
    orderBy: [{ dueDate: "asc" }, { submittedForReviewAt: "asc" }],
    include: { editor: { select: { name: true } }, client: { select: { name: true } }, reviewer: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Pending Reviews</h1>
        <p className="page-sub">Cuts waiting for internal review{isAdmin ? " across the team" : " assigned to you"}.</p>
      </div>

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100/60 dark:border-white/[0.04] flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 grid place-items-center"><Icon name="clock" className="h-4 w-4" /></div>
          <h2 className="text-sm font-bold text-ink-900 dark:text-white">Internal review</h2>
          <span className="ml-auto badge bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 text-xs">{pending.length} pending</span>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-ink-400">
            <Icon name="check" className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-medium">All clear — nothing waiting for review.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50/50 dark:bg-white/[0.02] text-[11px] text-ink-500 uppercase tracking-wider text-left">
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Editor</th>
                <th className="px-4 py-3 font-semibold">Reviewer</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{projectCode(p.projectNo)}</td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="truncate text-ink-800 dark:text-gray-200">{p.title}</div>
                    <div className="text-[11px] text-ink-400">{p.client?.name ?? "—"}{p.revisionCount ? ` · round ${p.revisionCount + 1}` : ""}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge text-[11px] ${priorityColor(p.priority)}`}>{PRIORITY_LABELS[p.priority]}</span></td>
                  <td className="px-4 py-3 text-ink-600">{p.editor?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-600">{p.reviewer?.name ?? "Anyone"}</td>
                  <td className="px-4 py-3 text-xs text-ink-400">{formatDate(p.submittedForReviewAt)}</td>
                  <td className="px-4 py-3"><DueCell dueDate={p.dueDate} stage={p.stage} isOverdue={p.isOverdue} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/projects/${p.id}`} className="btn-secondary py-1.5 px-3 text-[11px] inline-flex items-center gap-1.5">Review <Icon name="arrow-right" className="h-3 w-3" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
