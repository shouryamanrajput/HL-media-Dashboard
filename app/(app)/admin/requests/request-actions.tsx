"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { approveRequest, rejectRequest } from "./actions";

type Req = { id: string; name: string; email: string; loginMethod: string };

const ROLE_OPTIONS: [string, string][] = [
  ["ADMIN", "Admin"],
  ["INVESTIGATOR", "Investigator"],
  ["REVIEWER_L1", "Reviewer (L1)"],
  ["REVIEWER_L2", "Reviewer (L2)"],
];

export function RequestActions({ req }: { req: Req }) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "approve" | "reject">(null);
  const [pending, setPending] = useState(false);

  // Approve form state
  const [roles, setRoles] = useState<Set<string>>(new Set(["INVESTIGATOR"]));
  const [scopeEntity, setScopeEntity] = useState("");
  const [scopeDept, setScopeDept] = useState("");
  const [note, setNote] = useState("");

  function toggleRole(role: string) {
    setRoles((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  }

  async function doApprove() {
    if (roles.size === 0) {
      alert("Select at least one role.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", req.id);
      roles.forEach((r) => fd.append("roles", r));
      fd.append("scopeEntity", scopeEntity);
      fd.append("scopeDept", scopeDept);
      await approveRequest(fd);
      setModal(null);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to approve request");
    } finally {
      setPending(false);
    }
  }

  async function doReject() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("id", req.id);
      fd.append("note", note);
      await rejectRequest(fd);
      setModal(null);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModal("approve")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          <Icon name="check" className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          type="button"
          onClick={() => setModal("reject")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-ink-600 dark:text-gray-300 hover:bg-ink-100 dark:hover:bg-white/5 transition-colors"
        >
          <Icon name="x" className="h-3.5 w-3.5" /> Reject
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => !pending && setModal(null)} />
          <div className="relative z-10 w-full max-w-[440px] rounded-2xl bg-white dark:bg-[#141a2a] shadow-2xl ring-1 ring-ink-200/60 dark:ring-white/10 p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className={`h-11 w-11 rounded-xl grid place-items-center ring-8 ${modal === "approve" ? "bg-emerald-50 text-emerald-600 ring-emerald-50/60" : "bg-rose-50 text-rose-600 ring-rose-50/60"}`}>
                <Icon name={modal === "approve" ? "user-plus" : "x"} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink-900 dark:text-white">
                  {modal === "approve" ? "Approve access" : "Reject request"}
                </h2>
                <p className="text-xs text-ink-500 dark:text-gray-400 mt-0.5">
                  {req.name} · {req.email}
                </p>
              </div>
            </div>

            {modal === "approve" ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Roles</label>
                  <div className="flex flex-wrap gap-3 py-1">
                    {ROLE_OPTIONS.map(([value, labelText]) => (
                      <label key={value} className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={roles.has(value)}
                          onChange={() => toggleRole(value)}
                          className="rounded border-ink-300"
                        />
                        {labelText}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Scope entity <span className="text-ink-300 font-normal">(optional)</span></label>
                    <input className="input" value={scopeEntity} onChange={(e) => setScopeEntity(e.target.value)} placeholder="e.g. OCL" />
                  </div>
                  <div>
                    <label className="label">Scope dept <span className="text-ink-300 font-normal">(optional)</span></label>
                    <input className="input" value={scopeDept} onChange={(e) => setScopeDept(e.target.value)} placeholder="optional" />
                  </div>
                </div>
                <p className="text-xs text-ink-400 dark:text-gray-500">
                  A user account is created and activated immediately. On their first sign-in they&apos;ll set up their profile and password.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="label">Reason <span className="text-ink-300 font-normal">(optional)</span></label>
                <textarea className="input min-h-[72px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note about why this was rejected…" />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" onClick={() => setModal(null)} disabled={pending} className="btn-secondary text-sm disabled:opacity-50">
                Cancel
              </button>
              {modal === "approve" ? (
                <button type="button" onClick={doApprove} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  <Icon name="check" className="h-4 w-4" /> {pending ? "Approving…" : "Approve & create user"}
                </button>
              ) : (
                <button type="button" onClick={doReject} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors">
                  {pending ? "Rejecting…" : "Reject request"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}