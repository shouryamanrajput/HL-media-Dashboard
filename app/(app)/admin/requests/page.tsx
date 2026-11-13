export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Icon } from "@/components/icon";
import { formatDateTime } from "@/lib/utils";
import { RequestActions } from "./request-actions";

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function MethodBadge({ method }: { method: string }) {
  if (method === "GOOGLE") {
    return (
      <span className="badge bg-ink-50 text-ink-600 ring-1 ring-ink-200/60 dark:bg-white/[0.04] dark:text-gray-300">
        <svg className="h-3 w-3" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z" />
        </svg>
        Google
      </span>
    );
  }
  return <span className="badge bg-ink-50 text-ink-600 ring-1 ring-ink-200/60 dark:bg-white/[0.04] dark:text-gray-300">Password</span>;
}

export default async function RequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!can(session.user, "request:manage")) return <div className="card p-6">Forbidden.</div>;

  const [pending, reviewed] = await Promise.all([
    db.userRequest.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "desc" } }),
    db.userRequest.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: { reviewedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Access Requests</h1>
        <p className="page-sub">
          People who signed in with Google but don&apos;t have an account yet. Approve to grant access, or reject.
        </p>
      </div>

      {/* Pending */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink-800 dark:text-white uppercase tracking-wide">Pending</h2>
          {pending.length > 0 && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold grid place-items-center">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="card p-10">
            <div className="empty">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-500 grid place-items-center">
                <Icon name="check" className="h-6 w-6" />
              </div>
              <div className="text-ink-900 dark:text-white font-semibold text-lg">You&apos;re all caught up</div>
              <div className="max-w-sm text-sm">No pending access requests right now.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#00BAF2] to-[#0080aa] text-white grid place-items-center font-bold text-sm shrink-0 shadow-sm">
                  {initials(r.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-900 dark:text-white text-[15px]">{r.name}</div>
                  <div className="text-sm text-ink-500 dark:text-gray-400 truncate">{r.email}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <MethodBadge method={r.loginMethod} />
                    <span className="text-[11px] text-ink-400 dark:text-gray-500 inline-flex items-center gap-1">
                      <Icon name="clock" className="h-3 w-3" /> Requested {formatDateTime(r.requestedAt)}
                    </span>
                  </div>
                </div>
                <div className="sm:ml-auto shrink-0">
                  <RequestActions req={{ id: r.id, name: r.name, email: r.email, loginMethod: r.loginMethod }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-ink-800 dark:text-white uppercase tracking-wide">Recently reviewed</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-100/50 dark:bg-white/[0.03] text-[11px] text-ink-500 dark:text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Outcome</th>
                    <th className="px-4 py-3 text-left font-semibold">Reviewed by</th>
                    <th className="px-4 py-3 text-left font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewed.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="px-4 py-3 font-medium text-ink-900 dark:text-gray-200">{r.name}</td>
                      <td className="px-4 py-3 text-ink-600 dark:text-gray-400">{r.email}</td>
                      <td className="px-4 py-3">
                        {r.status === "APPROVED" ? (
                          <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">Approved</span>
                        ) : (
                          <span className="badge bg-rose-50 text-rose-700 ring-1 ring-rose-200/60">Rejected</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-600 dark:text-gray-400">{r.reviewedBy?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-ink-400 dark:text-gray-500">{formatDateTime(r.reviewedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}