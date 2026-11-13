export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { myProjectsFilter, projectVisibilityFilter } from "@/lib/rbac";
import { getScope } from "@/lib/scope";
import { PIPELINE_STAGES, STAGE_CHART_COLORS, STAGE_LABELS, isOpenStage, projectCode, stageColor } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";
import { BarPanel, LinePanel, PiePanel } from "@/components/charts";
import { DueCell } from "@/components/due-cell";

function monthKey(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const u = session.user;
  const scope = await getScope();

  const projects = await db.project.findMany({
    where: { AND: [projectVisibilityFilter(u), scope === "mine" ? myProjectsFilter(u) : {}] },
    include: { client: { select: { name: true } }, projectType: { select: { name: true } }, editor: { select: { name: true } } },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const open = projects.filter((p) => isOpenStage(p.stage) && p.stage !== "ON_HOLD");
  const overdue = open.filter((p) => p.isOverdue);
  const dueWeek = open.filter((p) => { const d = daysUntil(p.dueDate); return d != null && d >= 0 && d <= 7; });
  const inReview = open.filter((p) => p.stage === "INTERNAL_REVIEW");
  const deliveredMonth = projects.filter((p) => p.deliveredAt && p.deliveredAt >= monthStart);
  const delivered = projects.filter((p) => p.stage === "DELIVERED" && p.turnaroundDays != null);
  const avgTurnaround = delivered.length ? delivered.reduce((s, p) => s + (p.turnaroundDays ?? 0), 0) / delivered.length : null;

  const byStage = PIPELINE_STAGES.filter((s) => s !== "DELIVERED")
    .map((s) => ({ name: STAGE_LABELS[s], value: open.filter((p) => p.stage === s).length, color: STAGE_CHART_COLORS[s] }));

  const months: { name: string; started: number; delivered: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    months.push({
      name: key,
      started: projects.filter((p) => monthKey(p.receivedDate) === key).length,
      delivered: projects.filter((p) => p.deliveredAt && monthKey(p.deliveredAt) === key).length,
    });
  }

  const tally = (keyOf: (p: (typeof projects)[number]) => string | undefined) => {
    const m = new Map<string, number>();
    for (const p of projects) { const k = keyOf(p); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const byType = tally((p) => p.projectType?.name);
  const topClients = tally((p) => p.client?.name).slice(0, 8);

  const upcoming = [...open].filter((p) => p.dueDate).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">{scope === "mine" ? "Your projects" : "All HL Media projects"} at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Active projects" value={open.length} href="/projects?open=1" />
        <Kpi label="Due in 7 days" value={dueWeek.length} />
        <Kpi label="Overdue" value={overdue.length} href="/projects?overdue=1" tone={overdue.length ? "text-rose-600" : undefined} />
        <Kpi label="In review" value={inReview.length} href="/reviews" />
        <Kpi label="Delivered this month" value={deliveredMonth.length} />
        <Kpi label="Avg turnaround" value={avgTurnaround != null ? `${avgTurnaround.toFixed(1)}d` : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarPanel title="Active projects by stage" data={byStage} />
        <LinePanel
          title="Started vs delivered"
          sub="Last 6 months"
          data={months}
          series={[{ key: "started", label: "Received", color: "#00BAF2" }, { key: "delivered", label: "Delivered", color: "#10b981" }]}
        />
        <PiePanel title="Projects by type" data={byType} />
        <BarPanel title="Top clients" sub="By number of projects" data={topClients} horizontal />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 section-title !mb-0">Coming up</div>
        <table className="w-full text-sm">
          <tbody>
            {upcoming.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="px-5 py-2.5 font-semibold whitespace-nowrap"><Link href={`/projects/${p.id}`} className="text-primary-700 dark:text-primary-400 hover:underline">{projectCode(p.projectNo)}</Link></td>
                <td className="px-3 py-2.5"><div className="text-ink-800 dark:text-gray-200">{p.title}</div><div className="text-[11px] text-ink-400">{p.client?.name ?? "—"}</div></td>
                <td className="px-3 py-2.5"><span className={`badge text-[11px] ${stageColor(p.stage)}`}>{STAGE_LABELS[p.stage]}</span></td>
                <td className="px-3 py-2.5 text-ink-600 text-xs">{p.editor?.name ?? "Unassigned"}</td>
                <td className="px-5 py-2.5"><DueCell dueDate={p.dueDate} stage={p.stage} isOverdue={p.isOverdue} /></td>
              </tr>
            ))}
            {upcoming.length === 0 && <tr><td className="px-5 py-8 text-center text-ink-400">No upcoming deadlines.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: string }) {
  const body = (
    <>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ""}`}>{value}</div>
    </>
  );
  return href ? <Link href={href} className="kpi block">{body}</Link> : <div className="kpi">{body}</div>;
}
