export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, projectCode, taskStatusColor, TASK_STATUS_LIST, TASK_STATUS_LABELS } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";
import { updateTask } from "../projects/actions";
import { Icon } from "@/components/icon";

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const sp = await searchParams;

  const tasks = await db.task.findMany({
    where: { assigneeId: session.user.id, ...(sp.done ? {} : { status: { not: "DONE" } }) },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: { project: { select: { id: true, projectNo: true, title: true, client: { select: { name: true } } } } },
  });
  const open = tasks.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => (daysUntil(t.dueDate) ?? 1) < 0).length;
  const hours = open.reduce((s, t) => s + Math.max(0, (t.estimateHours ?? 0) - t.loggedHours), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-sub">{open.length} open · {overdue} overdue · ~{hours.toFixed(1)}h of estimated work left</p>
        </div>
        <Link href={sp.done ? "/tasks" : "/tasks?done=1"} className="btn-secondary text-xs">{sp.done ? "Hide completed" : "Show completed"}</Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-100/50 dark:bg-white/[0.03] text-[11px] text-ink-500 uppercase tracking-wider text-left">
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Hours</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const d = t.status === "DONE" ? null : daysUntil(t.dueDate);
              return (
                <tr key={t.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className={`font-medium ${t.status === "DONE" ? "line-through text-ink-400" : "text-ink-900 dark:text-gray-200"}`}>{t.title}</div>
                    {t.description && <div className="text-[11px] text-ink-400">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${t.project.id}`} className="text-primary-700 dark:text-primary-400 hover:underline text-xs font-semibold">{projectCode(t.project.projectNo)}</Link>
                    <div className="text-[11px] text-ink-500">{t.project.title}{t.project.client ? ` · ${t.project.client.name}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {formatDate(t.dueDate)}
                    {d != null && <div className={`text-[11px] font-semibold ${d < 0 ? "text-rose-600" : d <= 2 ? "text-amber-600" : "text-ink-400"}`}>{d < 0 ? `${-d}d overdue` : d === 0 ? "Today" : `${d}d left`}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">{t.loggedHours}h{t.estimateHours ? ` / ${t.estimateHours}h` : ""}</td>
                  <td className="px-4 py-3">
                    <form action={updateTask} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={t.id} />
                      <select className="input !py-1.5 !text-xs w-32" name="status" defaultValue={t.status}>
                        {TASK_STATUS_LIST.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                      </select>
                      <input className="input !py-1.5 !text-xs w-20" name="addHours" type="number" step="0.25" placeholder="+hrs" />
                      <button className="btn-secondary !py-1.5 !px-3 text-xs">Save</button>
                      <span className={`badge text-[10px] ${taskStatusColor(t.status)}`}>{TASK_STATUS_LABELS[t.status]}</span>
                    </form>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><Icon name="check" className="h-8 w-8 text-emerald-400" /><div className="text-sm font-medium">Nothing on your plate.</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
