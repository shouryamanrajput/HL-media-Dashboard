import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { can, canEditProject, canViewProject, hasRole } from "@/lib/rbac";
import {
  formatDate, formatDateTime, formatDuration, toInputDate, projectCode,
  priorityColor, stageColor, reviewStatusColor, taskStatusColor, deliverableStatusColor,
  STAGE_LIST, STAGE_LABELS, PIPELINE_STAGES, PRIORITY_LABELS, REVIEW_STATUS_LABELS,
  TASK_STATUS_LIST, TASK_STATUS_LABELS, DELIVERABLE_STATUS_LIST, DELIVERABLE_STATUS_LABELS,
  ASSET_KIND_LIST, ASSET_KIND_LABELS, SOURCE_LIST, PLATFORM_LIST, ASPECT_RATIO_LIST,
} from "@/lib/utils";
import {
  assignProject, updateProject, submitForReview, reviewProject, deleteProject,
  createTask, updateTask, deleteTask, addDeliverable, updateDeliverable, deleteDeliverable,
  addAsset, deleteAsset, addComment,
} from "../actions";
import { Icon } from "@/components/icon";
import { Toast } from "@/components/toast";
import { SaveButton } from "@/components/save-button";
import { DueCell } from "@/components/due-cell";

type SP = { saved?: string; assigned?: string; submitted?: string; reviewed?: string };

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const u = session.user;

  const p = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      projectType: true,
      editor: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      creator: { select: { name: true } },
      tasks: { include: { assignee: { select: { id: true, name: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      deliverables: { orderBy: { createdAt: "asc" } },
      assets: { include: { uploadedBy: { select: { name: true } } }, orderBy: { uploadedAt: "desc" } },
      comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      auditLogs: { include: { user: { select: { name: true } } }, orderBy: { at: "desc" }, take: 40 },
    },
  });
  if (!p) notFound();
  if (!can(u, "project:view") || !canViewProject(u, p)) notFound();

  const [users, clients, projectTypes] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, roles: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.projectType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const withRole = (r: string) => users.filter((x) => (x.roles || x.role).split(",").some((y) => y.trim() === r || y.trim() === "ADMIN"));
  const editors = withRole("EDITOR");
  const reviewers = withRole("REVIEWER");

  const canEdit = canEditProject(u, p);
  const canSubmit = canEdit && can(u, "project:submit-for-review") && ["EDITING", "REVISIONS", "FOOTAGE_RECEIVED"].includes(p.stage);
  const canReview = can(u, "project:review") && p.stage === "INTERNAL_REVIEW" && (hasRole(u, "ADMIN") || p.reviewerId === u.id || !p.reviewerId);
  const doneTasks = p.tasks.filter((t) => t.status === "DONE").length;
  const progress = p.tasks.length ? Math.round((doneTasks / p.tasks.length) * 100) : null;
  const loggedHours = p.tasks.reduce((s, t) => s + t.loggedHours, 0);
  const estimatedHours = p.tasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const stageIdx = PIPELINE_STAGES.indexOf(p.stage as (typeof PIPELINE_STAGES)[number]);

  return (
    <div className="space-y-5">
      {sp.saved && <Toast message="Project updated." />}
      {sp.assigned && <Toast message="Editor assigned." />}
      {sp.submitted && <Toast message="Submitted for internal review." />}
      {sp.reviewed && <Toast message="Review recorded." />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-ink-400 dark:text-gray-500 uppercase tracking-wider">
            {projectCode(p.projectNo)} {p.client && <>· <Link href={`/projects?client=${p.client.id}`} className="hover:text-primary-600">{p.client.name}</Link></>}
          </div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white mt-0.5">{p.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`badge ${stageColor(p.stage)}`}>{STAGE_LABELS[p.stage] ?? p.stage}</span>
            <span className={`badge ${priorityColor(p.priority)}`}>{PRIORITY_LABELS[p.priority] ?? p.priority}</span>
            {p.isOverdue && <span className="badge bg-rose-100 text-rose-700">OVERDUE</span>}
            {p.revisionCount > 0 && <span className="badge bg-orange-50 text-orange-700">{p.revisionCount} revision round{p.revisionCount > 1 ? "s" : ""}</span>}
            <span className="text-[11px] text-ink-400 dark:text-gray-500">Created {formatDate(p.createdAt)} by {p.creator.name}</span>
          </div>
        </div>
        {can(u, "project:assign") && (
          <form action={assignProject} className="flex items-end gap-2 shrink-0">
            <input type="hidden" name="id" value={p.id} />
            <div>
              <label className="label">Editor</label>
              <select className="input" name="editorId" defaultValue={p.editorId ?? ""}>
                <option value="">— Unassigned —</option>
                {editors.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button className="btn-secondary">Assign</button>
          </form>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Due"><DueCell dueDate={p.dueDate} stage={p.stage} isOverdue={p.isOverdue} /></Stat>
        <Stat label="Editor">{p.editor?.name ?? "Unassigned"}</Stat>
        <Stat label="Reviewer">{p.reviewer?.name ?? "—"}</Stat>
        <Stat label="Tasks done">{progress == null ? "No tasks" : `${doneTasks}/${p.tasks.length} (${progress}%)`}</Stat>
        <Stat label="Hours">{loggedHours.toFixed(1)}h logged{estimatedHours ? ` / ${estimatedHours.toFixed(1)}h est.` : ""}</Stat>
      </div>

      {/* Workflow */}
      <Section icon="check" tone="bg-cyan-100 text-cyan-600" title="Workflow">
        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((s, i) => {
            const isActive = s === p.stage;
            const isDone = stageIdx >= 0 && i < stageIdx;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${isActive ? "bg-primary-100 text-primary-700 ring-2 ring-primary-300" : isDone ? "bg-emerald-50 text-emerald-700" : "bg-ink-100/50 text-ink-400"}`}>
                  {isDone && <Icon name="check" className="h-3 w-3" />}
                  {STAGE_LABELS[s]}
                </div>
                {i < PIPELINE_STAGES.length - 1 && <div className={`w-4 h-0.5 shrink-0 ${isDone ? "bg-emerald-300" : "bg-ink-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>
        {(p.stage === "ON_HOLD" || p.stage === "CANCELLED") && (
          <p className="text-xs text-ink-600 bg-ink-100 px-3 py-1.5 rounded-lg mb-4 inline-block">This project is {STAGE_LABELS[p.stage].toLowerCase()}.</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-ink-50 dark:bg-white/[0.02] rounded-xl">
          <Stamp label="Received" value={formatDate(p.receivedDate)} />
          <Stamp label="Editing started" value={formatDate(p.startDate)} />
          <Stamp label="Sent for review" value={formatDateTime(p.submittedForReviewAt)} />
          <Stamp label="Delivered" value={p.deliveredAt ? `${formatDate(p.deliveredAt)} (${p.turnaroundDays}d)` : "—"} />
        </div>

        {p.reviewStatus && (
          <div className={`p-3 rounded-xl mb-3 border ${p.reviewStatus === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"} dark:bg-white/[0.03] dark:border-white/10`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`badge text-xs ${reviewStatusColor(p.reviewStatus)}`}>{REVIEW_STATUS_LABELS[p.reviewStatus]}</span>
              <span className="text-xs text-ink-400 font-normal">by {p.reviewer?.name ?? "—"} · {formatDateTime(p.reviewedAt)}</span>
            </div>
            {p.reviewComments && <p className="text-sm text-ink-600 dark:text-gray-400 mt-1 whitespace-pre-line">{p.reviewComments}</p>}
          </div>
        )}

        {canSubmit && (
          <form action={submitForReview} className="mt-3 p-4 rounded-xl border border-primary-200/60 bg-primary-50/50 dark:bg-primary-900/10 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex-1 min-w-[220px]">
              <label className="label">Send cut for internal review to</label>
              <select className="input" name="reviewerId" required defaultValue={p.reviewerId ?? ""}>
                <option value="">— Select a reviewer —</option>
                {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <SaveButton label="Submit for review" />
          </form>
        )}

        {canReview && (
          <form action={reviewProject} className="mt-3 p-4 rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
            <input type="hidden" name="id" value={p.id} />
            <div className="text-sm font-semibold text-ink-800 dark:text-white">Internal review</div>
            <textarea className="input" name="comments" rows={3} placeholder="Feedback for the editor (required when requesting changes)…" />
            <div className="flex gap-2">
              <button name="decision" value="APPROVED" className="btn-primary">Approve → Final export</button>
              <button name="decision" value="CHANGES_REQUESTED" className="btn-secondary">Request changes</button>
            </div>
          </form>
        )}
      </Section>

      {/* Details */}
      <Section icon="briefcase" tone="bg-primary-100 text-primary-600" title="Details">
        {canEdit ? (
          <form action={updateProject} className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Title" className="md:col-span-2"><input className="input" name="title" defaultValue={p.title} required /></Field>
            <Field label="Stage">
              <select className="input" name="stage" defaultValue={p.stage}>
                {STAGE_LIST.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Brief" className="md:col-span-3"><textarea className="input" rows={3} name="brief" defaultValue={p.brief ?? ""} /></Field>
            <Field label="Client">
              <select className="input" name="clientId" defaultValue={p.clientId ?? ""}>
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Project type">
              <select className="input" name="projectTypeId" defaultValue={p.projectTypeId ?? ""}>
                <option value="">—</option>
                {projectTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" name="priority" defaultValue={p.priority}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select className="input" name="source" defaultValue={p.source ?? ""}>
                <option value="">—</option>
                {SOURCE_LIST.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Received date"><input className="input" type="date" name="receivedDate" defaultValue={toInputDate(p.receivedDate)} /></Field>
            <Field label="Due date"><input className="input" type="date" name="dueDate" defaultValue={toInputDate(p.dueDate)} /></Field>
            <Field label="Final delivery link" className="md:col-span-2"><input className="input" name="finalLink" defaultValue={p.finalLink ?? ""} placeholder="https://…" /></Field>
            <Field label="Overdue reason"><input className="input" name="overdueReason" defaultValue={p.overdueReason ?? ""} /></Field>
            <Field label="Delivery notes" className="md:col-span-3"><textarea className="input" rows={2} name="deliveryNotes" defaultValue={p.deliveryNotes ?? ""} /></Field>
            <div className="md:col-span-3 flex justify-end pt-2"><SaveButton label="Save changes" /></div>
          </form>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <DataRow k="Client" v={p.client?.name ?? "—"} />
            <DataRow k="Project type" v={p.projectType?.name ?? "—"} />
            <DataRow k="Source" v={p.source ?? "—"} />
            <DataRow k="Received" v={formatDate(p.receivedDate)} />
            <DataRow k="Due" v={formatDate(p.dueDate)} />
            <DataRow k="Final link" v={p.finalLink ? <a href={p.finalLink} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">Open</a> : "—"} />
            <div className="col-span-2 md:col-span-3"><DataRow k="Brief" v={<span className="whitespace-pre-line">{p.brief ?? "—"}</span>} /></div>
            {p.deliveryNotes && <div className="col-span-2 md:col-span-3"><DataRow k="Delivery notes" v={p.deliveryNotes} /></div>}
          </div>
        )}
      </Section>

      {/* Tasks */}
      <Section icon="list" tone="bg-violet-100 text-violet-600" title={`Tasks (${doneTasks}/${p.tasks.length} done)`}>
        <div className="divide-y divide-ink-100 dark:divide-white/[0.06] mb-4">
          {p.tasks.map((t) => (
            <div key={t.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className={`text-sm font-medium ${t.status === "DONE" ? "line-through text-ink-400" : "text-ink-900 dark:text-gray-200"}`}>{t.title}</div>
                <div className="text-[11px] text-ink-400">
                  {t.assignee?.name ?? "Unassigned"} · due {formatDate(t.dueDate)} · {t.loggedHours}h{t.estimateHours ? ` / ${t.estimateHours}h` : ""}
                </div>
                {t.description && <div className="text-xs text-ink-500 mt-0.5">{t.description}</div>}
              </div>
              <form action={updateTask} className="flex items-center gap-1.5">
                <input type="hidden" name="id" value={t.id} />
                <select className="input !py-1.5 !text-xs w-32" name="status" defaultValue={t.status}>
                  {TASK_STATUS_LIST.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                </select>
                <input className="input !py-1.5 !text-xs w-20" name="addHours" type="number" step="0.25" placeholder="+hrs" />
                <button className="btn-secondary !py-1.5 !px-3 text-xs">Update</button>
              </form>
              <span className={`badge text-[11px] ${taskStatusColor(t.status)}`}>{TASK_STATUS_LABELS[t.status]}</span>
              {canEdit && (
                <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button className="text-ink-300 hover:text-rose-600" title="Delete task"><Icon name="x" className="h-4 w-4" /></button></form>
              )}
            </div>
          ))}
          {p.tasks.length === 0 && <div className="py-3 text-sm text-ink-400">No tasks yet — break the project into steps below.</div>}
        </div>
        {can(u, "task:create") && (
          <form action={createTask} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end p-3 rounded-xl bg-ink-50 dark:bg-white/[0.02]">
            <input type="hidden" name="projectId" value={p.id} />
            <Field label="New task" className="col-span-2"><input className="input" name="title" required placeholder="e.g. Rough cut, Color grade, Subtitles" /></Field>
            <Field label="Assignee">
              <select className="input" name="assigneeId" defaultValue={p.editorId ?? ""}>
                <option value="">—</option>
                {users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
            <Field label="Due"><input className="input" type="date" name="dueDate" /></Field>
            <Field label="Est. hours"><input className="input" type="number" step="0.5" name="estimateHours" /></Field>
            <button className="btn-primary">Add task</button>
          </form>
        )}
      </Section>

      {/* Deliverables */}
      <Section icon="bookmark" tone="bg-indigo-100 text-indigo-600" title={`Deliverables (${p.deliverables.length})`}>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-ink-500 uppercase tracking-wider text-left">
                <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Platform</th><th className="py-2 pr-3">Ratio</th><th className="py-2 pr-3">Length</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Link</th><th />
              </tr>
            </thead>
            <tbody>
              {p.deliverables.map((d) => (
                <tr key={d.id} className="table-row">
                  <td className="py-2 pr-3 font-medium">{d.name}</td>
                  <td className="py-2 pr-3">{d.platform ?? "—"}</td>
                  <td className="py-2 pr-3">{d.aspectRatio ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatDuration(d.durationSec)}</td>
                  <td className="py-2 pr-3">
                    <form action={updateDeliverable} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={d.id} />
                      <select className="input !py-1 !text-xs w-28" name="status" defaultValue={d.status}>
                        {DELIVERABLE_STATUS_LIST.map((s) => <option key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</option>)}
                      </select>
                      <button className="text-[11px] font-semibold text-primary-600">Save</button>
                      <span className={`badge text-[10px] ${deliverableStatusColor(d.status)}`}>{DELIVERABLE_STATUS_LABELS[d.status]}</span>
                    </form>
                  </td>
                  <td className="py-2 pr-3">{d.link ? <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">Open</a> : "—"}</td>
                  <td className="py-2 text-right">
                    {canEdit && <form action={deleteDeliverable}><input type="hidden" name="id" value={d.id} /><button className="text-ink-300 hover:text-rose-600"><Icon name="x" className="h-4 w-4" /></button></form>}
                  </td>
                </tr>
              ))}
              {p.deliverables.length === 0 && <tr><td colSpan={7} className="py-3 text-ink-400">No deliverables yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addDeliverable} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end p-3 rounded-xl bg-ink-50 dark:bg-white/[0.02]">
          <input type="hidden" name="projectId" value={p.id} />
          <Field label="Deliverable" className="col-span-2"><input className="input" name="name" required placeholder="e.g. Main film, Reel cutdown" /></Field>
          <Field label="Platform">
            <select className="input" name="platform" defaultValue=""><option value="">—</option>{PLATFORM_LIST.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Ratio">
            <select className="input" name="aspectRatio" defaultValue=""><option value="">—</option>{ASPECT_RATIO_LIST.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Min"><input className="input" type="number" min={0} name="durationMin" /></Field>
          <Field label="Sec"><input className="input" type="number" min={0} max={59} name="durationSecPart" /></Field>
          <button className="btn-primary">Add</button>
        </form>
      </Section>

      {/* Files & links */}
      <Section icon="upload" tone="bg-amber-100 text-amber-600" title={`Files & links (${p.assets.length})`}>
        <ul className="text-sm divide-y divide-ink-100 dark:divide-white/[0.06] mb-4">
          {p.assets.map((a) => (
            <li key={a.id} className="py-2.5 flex justify-between items-center gap-3">
              <span className="min-w-0">
                <span className="badge bg-ink-100 text-ink-600 text-[10px] mr-2">{ASSET_KIND_LABELS[a.kind] ?? a.kind}{a.version ? ` v${a.version}` : ""}</span>
                <a className="text-primary-700 hover:text-primary-500 font-medium" href={a.url ?? `/api/assets/${a.id}`} target={a.url ? "_blank" : undefined} rel="noopener noreferrer">{a.label}</a>
                {a.size != null && <span className="text-[11px] text-ink-400 ml-2">({Math.round(a.size / 1024)} KB)</span>}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-ink-400">{a.uploadedBy.name} · {formatDateTime(a.uploadedAt)}</span>
                {(canEdit || a.uploadedById === u.id) && (
                  <form action={deleteAsset}><input type="hidden" name="id" value={a.id} /><button className="text-ink-300 hover:text-rose-600"><Icon name="x" className="h-4 w-4" /></button></form>
                )}
              </span>
            </li>
          ))}
          {p.assets.length === 0 && <li className="py-3 text-ink-400">No files yet. Paste Frame.io / Drive / Dropbox links for large videos.</li>}
        </ul>
        <form action={addAsset} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end p-3 rounded-xl bg-ink-50 dark:bg-white/[0.02]">
          <input type="hidden" name="projectId" value={p.id} />
          <Field label="Type">
            <select className="input" name="kind" defaultValue="DRAFT">{ASSET_KIND_LIST.map((k) => <option key={k} value={k}>{ASSET_KIND_LABELS[k]}</option>)}</select>
          </Field>
          <Field label="Label"><input className="input" name="label" placeholder="Optional" /></Field>
          <Field label="Link" className="col-span-2"><input className="input" name="url" placeholder="https://frame.io/…" /></Field>
          <Field label="…or upload (max 50 MB)"><input className="input !py-2" type="file" name="file" /></Field>
          <button className="btn-primary">Add</button>
        </form>
      </Section>

      {/* Comments */}
      <Section icon="edit" tone="bg-sky-100 text-sky-600" title={`Comments (${p.comments.length})`}>
        <form action={addComment} className="flex gap-2 mb-4">
          <input type="hidden" name="projectId" value={p.id} />
          <input className="input flex-1" name="body" required placeholder="Write a comment for the team…" />
          <button className="btn-secondary">Post</button>
        </form>
        <ul className="space-y-3">
          {p.comments.map((c) => (
            <li key={c.id} className="border-l-2 border-sky-200 pl-3">
              <div className="text-[11px] text-ink-400"><span className="font-semibold text-ink-600 dark:text-gray-300">{c.user.name}</span> · {formatDateTime(c.createdAt)}</div>
              <div className="text-sm text-ink-800 dark:text-gray-200 whitespace-pre-line">{c.body}</div>
            </li>
          ))}
          {p.comments.length === 0 && <li className="text-sm text-ink-400">No comments yet.</li>}
        </ul>
      </Section>

      {/* Activity */}
      <Section icon="history" tone="bg-ink-100 text-ink-600" title="Activity">
        <ul className="space-y-3">
          {p.auditLogs.map((l) => {
            let diff: Record<string, { before: unknown; after: unknown }> = {};
            try { diff = JSON.parse(l.diff); } catch {}
            return (
              <li key={l.id} className="border-l-2 border-primary-200 pl-3">
                <div className="text-[11px] text-ink-400 flex items-center gap-1.5">
                  <span>{formatDateTime(l.at)}</span>·<span className="font-medium text-ink-600">{l.user.name}</span>·
                  <span className="font-semibold text-ink-700 bg-ink-100 px-1.5 py-0.5 rounded">{l.entity === "Project" ? l.action : `${l.entity} ${l.action}`}</span>
                </div>
                <ul className="text-xs mt-1 space-y-0.5">
                  {Object.entries(diff).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-ink-500">{k}:</span>{" "}
                      {v.before != null && <><span className="text-ink-400 line-through">{String(STAGE_LABELS[String(v.before)] ?? v.before)}</span>{" → "}</>}
                      <span className="text-ink-900 dark:text-gray-200 font-medium">{String(STAGE_LABELS[String(v.after)] ?? v.after ?? "—")}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
          {p.auditLogs.length === 0 && <li className="text-ink-400 text-sm">No activity yet.</li>}
        </ul>
      </Section>

      {can(u, "project:delete") && (
        <form action={deleteProject} className="flex justify-end">
          <input type="hidden" name="id" value={p.id} />
          <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">Delete this project permanently</button>
        </form>
      )}
    </div>
  );
}

type IconName = React.ComponentProps<typeof Icon>["name"];

function Section({ icon, tone, title, children }: { icon: IconName; tone: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="section-title mb-4">
        <div className={`h-6 w-6 rounded-lg ${tone} grid place-items-center`}><Icon name={icon} className="h-3.5 w-3.5" /></div>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-sm font-medium text-ink-900 dark:text-gray-200 mt-0.5">{children}</div>
    </div>
  );
}

function Stamp({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-sm font-medium text-ink-800 dark:text-gray-300 mt-0.5">{value}</div>
    </div>
  );
}

function DataRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-ink-400 dark:text-gray-500 font-medium uppercase tracking-wide">{k}</div>
      <div className="text-sm font-medium text-ink-900 dark:text-gray-200 mt-0.5">{v}</div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
