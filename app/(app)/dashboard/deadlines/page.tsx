export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectVisibilityFilter } from "@/lib/rbac";
import { STAGE_LABELS, formatDate, isOpenStage, projectCode } from "@/lib/utils";
import { BarPanel, LinePanel } from "@/components/charts";

function monthKey(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export default async function DeadlinesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const projects = await db.project.findMany({
    where: projectVisibilityFilter(session.user),
    include: { projectType: { select: { name: true } }, client: { select: { name: true } }, editor: { select: { name: true } } },
  });

  const delivered = projects.filter((p) => p.stage === "DELIVERED" && p.deliveredAt);
  const withDue = delivered.filter((p) => p.dueDate);
  const onTime = withDue.filter((p) => p.deliveredAt! <= endOfDay(p.dueDate!));
  const onTimePct = withDue.length ? Math.round((onTime.length / withDue.length) * 100) : null;
  const avgTurnaround = delivered.length ? delivered.reduce((s, p) => s + (p.turnaroundDays ?? 0), 0) / delivered.length : null;
  const avgRevisions = delivered.length ? delivered.reduce((s, p) => s + p.revisionCount, 0) / delivered.length : null;
  const overdueOpen = projects.filter((p) => isOpenStage(p.stage) && p.isOverdue).sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  const typeMap = new Map<string, { sum: number; n: number }>();
  for (const p of delivered) {
    const k = p.projectType?.name ?? "Other";
    const e = typeMap.get(k) ?? { sum: 0, n: 0 };
    e.sum += p.turnaroundDays ?? 0;
    e.n += 1;
    typeMap.set(k, e);
  }
  const turnaroundByType = [...typeMap.entries()].map(([name, e]) => ({ name, value: Math.round((e.sum / e.n) * 10) / 10 }));

  const now = new Date();
  const trend: { name: string; onTime: number; late: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const inMonth = withDue.filter((p) => monthKey(p.deliveredAt!) === key);
    const ok = inMonth.filter((p) => p.deliveredAt! <= endOfDay(p.dueDate!)).length;
    trend.push({ name: key, onTime: ok, late: inMonth.length - ok });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Deadlines &amp; Turnaround</h1>
        <p className="page-sub">How reliably projects are delivered on time, and how long they take.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi"><div className="kpi-label">On-time delivery</div><div className="kpi-value">{onTimePct != null ? `${onTimePct}%` : "—"}</div><div className="kpi-hint">{onTime.length} of {withDue.length} with a due date</div></div>
        <div className="kpi"><div className="kpi-label">Avg turnaround</div><div className="kpi-value">{avgTurnaround != null ? `${avgTurnaround.toFixed(1)}d` : "—"}</div><div className="kpi-hint">Received → delivered</div></div>
        <div className="kpi"><div className="kpi-label">Avg revision rounds</div><div className="kpi-value">{avgRevisions != null ? avgRevisions.toFixed(1) : "—"}</div><div className="kpi-hint">Per delivered project</div></div>
        <div className="kpi"><div className="kpi-label">Overdue now</div><div className={`kpi-value ${overdueOpen.length ? "text-rose-600" : ""}`}>{overdueOpen.length}</div><div className="kpi-hint">Open projects past due</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LinePanel title="On-time vs late deliveries" sub="Last 6 months" data={trend} series={[{ key: "onTime", label: "On time", color: "#10b981" }, { key: "late", label: "Late", color: "#e11d48" }]} />
        <BarPanel title="Avg turnaround by project type" unit=" days" data={turnaroundByType} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 section-title !mb-0">Overdue projects</div>
        <table className="w-full text-sm">
          <tbody>
            {overdueOpen.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="px-5 py-2.5 font-semibold"><Link href={`/projects/${p.id}`} className="text-primary-700 dark:text-primary-400 hover:underline">{projectCode(p.projectNo)}</Link></td>
                <td className="px-3 py-2.5"><div>{p.title}</div><div className="text-[11px] text-ink-400">{p.client?.name ?? "—"} · {STAGE_LABELS[p.stage]}</div></td>
                <td className="px-3 py-2.5 text-xs text-ink-600">{p.editor?.name ?? "Unassigned"}</td>
                <td className="px-3 py-2.5 text-xs text-rose-600 font-semibold">Due {formatDate(p.dueDate)}</td>
                <td className="px-5 py-2.5 text-xs text-ink-500">{p.overdueReason ?? ""}</td>
              </tr>
            ))}
            {overdueOpen.length === 0 && <tr><td className="px-5 py-8 text-center text-ink-400">Nothing overdue.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
