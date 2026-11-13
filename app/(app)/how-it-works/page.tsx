import Link from "next/link";
import { STAGE_LABELS, STAGE_LIST, stageColor } from "@/lib/utils";

const STAGE_HELP: Record<string, string> = {
  BRIEF: "The request is logged: client, type, due date and what they want.",
  PRE_PRODUCTION: "Scripts, shot lists, music and references are prepared.",
  FOOTAGE_RECEIVED: "Raw footage is in. Upload it or paste the Drive/Dropbox link under Files & links.",
  EDITING: "The editor is cutting. The start date is recorded automatically.",
  INTERNAL_REVIEW: "The editor submitted a cut. A reviewer approves it or requests changes.",
  REVISIONS: "Changes were requested. Each round adds to the revision count.",
  FINAL_EXPORT: "Approved. Exporting masters and the cutdowns listed under Deliverables.",
  DELIVERED: "Sent to the client. The delivered date and turnaround are recorded.",
  ON_HOLD: "Paused, e.g. waiting on footage or feedback. Not shown on the board.",
  CANCELLED: "Dropped. Kept for history and excluded from active counts.",
};

const ROLES = [
  { name: "Admin", text: "Everything: create and assign projects, manage clients, users, project types and imports, review any cut." },
  { name: "Editor", text: "Sees projects they edit or have tasks on. Updates stages, logs hours, uploads files and submits cuts for review." },
  { name: "Reviewer", text: "Sees all projects. Works the Pending Reviews queue and approves cuts or sends them back with notes." },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">How it Works</h1>
        <p className="page-sub">HL Media&apos;s internal tool for running video projects from brief to delivery. Clients never log in.</p>
      </div>

      <section className="card p-6 space-y-4">
        <h2 className="section-title">Project stages</h2>
        <ol className="space-y-2.5">
          {STAGE_LIST.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="text-[11px] font-bold text-ink-300 w-5 pt-1 tabular-nums">{i + 1}</span>
              <span className={`badge text-[11px] w-36 justify-center shrink-0 ${stageColor(s)}`}>{STAGE_LABELS[s]}</span>
              <span className="text-sm text-ink-600 dark:text-gray-400">{STAGE_HELP[s]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="section-title">Review loop</h2>
        <p className="text-sm text-ink-600 dark:text-gray-400">
          From a project page the editor clicks <b>Submit for review</b> and picks a reviewer. The project moves to Internal Review and shows up in that
          reviewer&apos;s <Link href="/reviews" className="text-primary-600 hover:underline">Pending Reviews</Link>. The reviewer either <b>Approves</b> (the project moves to Final Export)
          or <b>Requests changes</b> with notes (it moves to Revisions and the revision count goes up). Every step is in the project&apos;s activity log.
        </p>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="section-title">Day to day</h2>
        <ul className="text-sm text-ink-600 dark:text-gray-400 list-disc pl-5 space-y-1.5">
          <li><Link href="/projects/board" className="text-primary-600 hover:underline">Board</Link>: drag cards between stages for a quick overview of the pipeline.</li>
          <li><Link href="/tasks" className="text-primary-600 hover:underline">My Tasks</Link>: your to-dos across projects. Update the status and log hours in one go.</li>
          <li><b>Files &amp; links</b>: upload drafts and finals (up to 50 MB) or paste links to large footage. Drafts and finals are versioned automatically.</li>
          <li><b>Deliverables</b>: list each export (platform, aspect ratio, length) and tick it off as it&apos;s delivered.</li>
          <li><b>Deadlines</b>: projects past their due date are flagged overdue. The Deadlines report tracks on-time rate and turnaround.</li>
          <li>The <b>My / Overall</b> toggle in the sidebar switches lists and dashboards between your work and the whole studio.</li>
        </ul>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="section-title">Roles</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {ROLES.map((r) => (
            <div key={r.name} className="rounded-xl bg-ink-50 dark:bg-white/[0.03] p-4">
              <div className="font-semibold text-ink-900 dark:text-white text-sm">{r.name}</div>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
