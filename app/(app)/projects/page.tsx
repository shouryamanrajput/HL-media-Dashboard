export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { listVisibleProjects } from "./actions";
import { priorityColor, stageColor, STAGE_LABELS, PRIORITY_LABELS, projectCode } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { DueCell } from "@/components/due-cell";
import { Toast } from "@/components/toast";
import { getScope } from "@/lib/scope";

type SP = { q?: string; priority?: string; stage?: string; client?: string; editor?: string; overdue?: string; open?: string; page?: string; sort?: string; deleted?: string };

function SortHeader({ label, field, currentSort, params }: { label: string; field: string; currentSort?: string; params: URLSearchParams }) {
  const [curField, curDir] = (currentSort ?? "").split(":");
  const active = curField === field;
  const sp = new URLSearchParams(params);
  sp.set("sort", `${field}:${active && curDir === "asc" ? "desc" : "asc"}`);
  sp.delete("page");
  return (
    <th className="px-4 py-3 text-left font-semibold">
      <Link href={`/projects?${sp.toString()}`} className="inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-white transition-colors">
        {label}
        <span className="text-[10px] leading-none">{active ? (curDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </Link>
    </th>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const scope = await getScope();
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [{ projects, total, page, totalPages }, clients, editors] = await Promise.all([
    listVisibleProjects(scope, { ...sp, page: pageNum }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const baseParams = new URLSearchParams();
  for (const k of ["q", "priority", "stage", "client", "editor", "overdue", "open", "sort"] as const) if (sp[k]) baseParams.set(k, sp[k]!);

  function pageHref(p: number) {
    const ps = new URLSearchParams(baseParams);
    if (p > 1) ps.set("page", String(p));
    const qs = ps.toString();
    return `/projects${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      {sp.deleted && <Toast message="Project deleted." />}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="page-title">{scope === "all" ? "All Projects" : "My Projects"}</h1>
          <p className="page-sub">
            Showing <span className="font-semibold text-ink-800 dark:text-white">{projects.length}</span> of {total} projects
            {scope === "all" ? " across HL Media" : " you're working on"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/projects/board" className="btn-secondary"><Icon name="chart" className="h-4 w-4" /> Board</Link>
          <Link href="/projects/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New Project</Link>
        </div>
      </div>

      <form className="card p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={sp.q ?? ""} placeholder="HLM-0001, title, client…" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Stage</label>
          <select className="input" name="stage" defaultValue={sp.stage ?? ""}>
            <option value="">All</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Client</label>
          <select className="input" name="client" defaultValue={sp.client ?? ""}>
            <option value="">All</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Editor</label>
          <select className="input" name="editor" defaultValue={sp.editor ?? ""}>
            <option value="">All</option>
            {editors.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="label">Priority</label>
          <select className="input" name="priority" defaultValue={sp.priority ?? ""}>
            <option value="">All</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-ink-600 dark:text-gray-400">
            <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} className="h-4 w-4 rounded border-ink-300 text-primary-600" />
            Overdue
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-ink-600 dark:text-gray-400">
            <input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} className="h-4 w-4 rounded border-ink-300 text-primary-600" />
            Open only
          </label>
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          <button className="btn-secondary text-xs">Apply</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-100/50 dark:bg-white/[0.03] text-[11px] text-ink-500 dark:text-gray-500 uppercase tracking-wider">
                <SortHeader label="Project" field="projectNo" currentSort={sp.sort} params={baseParams} />
                <th className="px-4 py-3 text-left font-semibold">Title</th>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <SortHeader label="Stage" field="stage" currentSort={sp.sort} params={baseParams} />
                <SortHeader label="Priority" field="priority" currentSort={sp.sort} params={baseParams} />
                <th className="px-4 py-3 text-left font-semibold">Editor</th>
                <th className="px-4 py-3 text-left font-semibold">Tasks</th>
                <SortHeader label="Due" field="dueDate" currentSort={sp.sort} params={baseParams} />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const done = p.tasks.filter((t) => t.status === "DONE").length;
                return (
                  <tr key={p.id} className="table-row">
                    <td className="px-4 py-3.5">
                      <Link className="font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-500 text-sm whitespace-nowrap" href={`/projects/${p.id}`}>{projectCode(p.projectNo)}</Link>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="truncate text-ink-900 dark:text-gray-200 font-medium text-sm">{p.title}</div>
                      <div className="text-[11px] text-ink-400 dark:text-gray-500">{p.projectType?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3.5 text-ink-700 dark:text-gray-300 text-sm">{p.client?.name ?? "—"}</td>
                    <td className="px-4 py-3.5"><span className={`badge ${stageColor(p.stage)}`}>{STAGE_LABELS[p.stage] ?? p.stage}</span></td>
                    <td className="px-4 py-3.5"><span className={`badge ${priorityColor(p.priority)}`}>{PRIORITY_LABELS[p.priority] ?? p.priority}</span></td>
                    <td className="px-4 py-3.5">
                      {p.editor ? <span className="text-ink-800 dark:text-gray-300 text-sm">{p.editor.name}</span> : <span className="text-ink-400 text-xs italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-600 dark:text-gray-400 tabular-nums">{p.tasks.length ? `${done}/${p.tasks.length}` : "—"}</td>
                    <td className="px-4 py-3.5"><DueCell dueDate={p.dueDate} stage={p.stage} isOverdue={p.isOverdue} /></td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="h-14 w-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-500 grid place-items-center">
                        <Icon name="search" className="h-6 w-6" />
                      </div>
                      <div className="text-ink-900 dark:text-white font-semibold text-lg">No projects found</div>
                      <div className="max-w-sm text-sm">Try adjusting the filters, switch to &quot;Overall&quot;, or start a new project.</div>
                      <Link href="/projects/new" className="btn-primary mt-3"><Icon name="plus" className="h-4 w-4" /> New Project</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-200/60 dark:border-white/[0.06] px-4 py-3">
            {page > 1 ? <Link href={pageHref(page - 1)} className="btn-secondary text-xs">&larr; Previous</Link> : <span className="btn-secondary text-xs opacity-40 pointer-events-none">&larr; Previous</span>}
            <span className="text-xs text-ink-500 dark:text-gray-500">Page {page} of {totalPages}</span>
            {page < totalPages ? <Link href={pageHref(page + 1)} className="btn-secondary text-xs">Next &rarr;</Link> : <span className="btn-secondary text-xs opacity-40 pointer-events-none">Next &rarr;</span>}
          </div>
        )}
      </div>
    </div>
  );
}
