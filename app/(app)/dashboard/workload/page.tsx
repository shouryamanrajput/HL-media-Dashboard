export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";
import { BarPanel } from "@/components/charts";

export default async function WorkloadPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      editedProjects: { where: { stage: { notIn: ["DELIVERED", "CANCELLED"] } }, select: { isOverdue: true, stage: true } },
      reviewedProjects: { where: { stage: "INTERNAL_REVIEW" }, select: { id: true } },
      assignedTasks: { where: { status: { not: "DONE" } }, select: { estimateHours: true, loggedHours: true, dueDate: true } },
    },
  });

  const rows = users.map((u) => {
    const hoursLeft = u.assignedTasks.reduce((s, t) => s + Math.max(0, (t.estimateHours ?? 0) - t.loggedHours), 0);
    return {
      id: u.id,
      name: u.name,
      role: (u.roles || u.role).split(",").map((r) => ROLE_LABELS[r.trim()] ?? r).join(", "),
      projects: u.editedProjects.length,
      overdueProjects: u.editedProjects.filter((p) => p.isOverdue).length,
      reviews: u.reviewedProjects.length,
      tasks: u.assignedTasks.length,
      overdueTasks: u.assignedTasks.filter((t) => (daysUntil(t.dueDate) ?? 1) < 0).length,
      hoursLeft,
      capacity: u.capacityHours,
      load: u.capacityHours ? Math.round((hoursLeft / u.capacityHours) * 100) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Team Workload</h1>
        <p className="page-sub">Open projects, tasks and remaining estimated hours per person, compared with weekly capacity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarPanel title="Open projects per editor" data={rows.filter((r) => r.projects).map((r) => ({ name: r.name, value: r.projects }))} horizontal />
        <BarPanel title="Estimated hours left" unit="h" data={rows.filter((r) => r.hoursLeft).map((r) => ({ name: r.name, value: Math.round(r.hoursLeft * 10) / 10, color: r.load != null && r.load > 100 ? "#e11d48" : undefined }))} horizontal />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-100/50 dark:bg-white/[0.03] text-[11px] text-ink-500 uppercase tracking-wider text-left">
              <th className="px-4 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold text-center">Projects</th>
              <th className="px-4 py-3 font-semibold text-center">Overdue</th>
              <th className="px-4 py-3 font-semibold text-center">Reviews</th>
              <th className="px-4 py-3 font-semibold text-center">Open tasks</th>
              <th className="px-4 py-3 font-semibold text-center">Late tasks</th>
              <th className="px-4 py-3 font-semibold">Hours left / capacity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="px-4 py-3"><div className="font-medium text-ink-900 dark:text-gray-200">{r.name}</div><div className="text-[11px] text-ink-400">{r.role}</div></td>
                <td className="px-4 py-3 text-center tabular-nums font-semibold">{r.projects}</td>
                <td className={`px-4 py-3 text-center tabular-nums ${r.overdueProjects ? "text-rose-600 font-semibold" : "text-ink-400"}`}>{r.overdueProjects}</td>
                <td className="px-4 py-3 text-center tabular-nums">{r.reviews}</td>
                <td className="px-4 py-3 text-center tabular-nums">{r.tasks}</td>
                <td className={`px-4 py-3 text-center tabular-nums ${r.overdueTasks ? "text-rose-600 font-semibold" : "text-ink-400"}`}>{r.overdueTasks}</td>
                <td className="px-4 py-3 w-64">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{r.hoursLeft.toFixed(1)}h{r.capacity ? ` / ${r.capacity}h` : ""}</span>
                    {r.load != null && <span className={r.load > 100 ? "text-rose-600 font-semibold" : "text-ink-400"}>{r.load}%</span>}
                  </div>
                  {r.load != null && (
                    <div className="h-1.5 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full ${r.load > 100 ? "bg-rose-500" : r.load > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, r.load)}%` }} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
