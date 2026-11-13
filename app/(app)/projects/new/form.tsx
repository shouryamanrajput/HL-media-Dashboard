"use client";
import { useRef, useState, useTransition } from "react";
import { PRIORITY_LABELS, SOURCE_LIST } from "@/lib/utils";

type Option = { id: string; name: string };

export function ProjectIntakeForm({
  action,
  clients,
  projectTypes,
  editors,
  reviewers,
}: {
  action: (fd: FormData) => Promise<void>;
  clients: Option[];
  projectTypes: Option[];
  editors: Option[];
  reviewers: Option[];
}) {
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  function submit() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setError(null);
    startTransition(async () => {
      try {
        await action(fd);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form ref={formRef} className="card p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <section>
        <h2 className="section-title mb-3">Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title*" className="col-span-2"><input className="input" name="title" required placeholder="e.g. Diwali campaign — 30s ad" /></Field>
          <Field label="Brief" className="col-span-2"><textarea className="input" name="brief" rows={4} placeholder="What needs to be made, style references, music, must-haves…" /></Field>
          <Field label="Project type">
            <select className="input" name="projectTypeId" defaultValue="">
              <option value="">—</option>
              {projectTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Priority*">
            <select className="input" name="priority" defaultValue="MEDIUM">
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">Client</h2>
        <div className="flex gap-2 mb-3">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setClientMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${clientMode === m ? "bg-primary-50 border-primary-300 text-primary-700" : "border-ink-200 text-ink-500"}`}
            >
              {m === "existing" ? "Existing client" : "New client"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {clientMode === "existing" ? (
            <Field label="Client">
              <select className="input" name="clientId" defaultValue="">
                <option value="">— No client / internal —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="New client name"><input className="input" name="newClientName" placeholder="Company or person" /></Field>
          )}
          <Field label="Source">
            <select className="input" name="source" defaultValue="">
              <option value="">—</option>
              {SOURCE_LIST.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">Team &amp; dates</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Editor">
            <select className="input" name="editorId" defaultValue="">
              <option value="">— Unassigned —</option>
              {editors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Reviewer">
            <select className="input" name="reviewerId" defaultValue="">
              <option value="">— Choose later —</option>
              {reviewers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Received date*"><input className="input" type="date" name="receivedDate" required defaultValue={today} /></Field>
          <Field label="Due date"><input className="input" type="date" name="dueDate" /></Field>
        </div>
      </section>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200/50">{error}</div>
      )}

      <div className="flex justify-end border-t border-ink-100 pt-4">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create project"}</button>
      </div>
    </form>
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
