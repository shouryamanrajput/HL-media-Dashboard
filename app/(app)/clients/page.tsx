export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { saveClient, deleteClient } from "./actions";
import { SaveButton } from "@/components/save-button";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const canManage = can(session.user, "client:manage");

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { projects: { select: { stage: true, dueDate: true, deliveredAt: true } } },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Clients</h1>
        <p className="page-sub">Who HL Media makes videos for. Clients don&apos;t log in — this is for internal reference.</p>
      </div>

      {canManage && (
        <form action={saveClient} className="card p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2"><label className="label">Client name*</label><input className="input" name="name" required /></div>
          <div><label className="label">Contact person</label><input className="input" name="contactName" /></div>
          <div><label className="label">Email</label><input className="input" name="email" type="email" /></div>
          <div><label className="label">Phone</label><input className="input" name="phone" /></div>
          <SaveButton label="Add client" />
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-100/50 dark:bg-white/[0.03] text-[11px] text-ink-500 uppercase tracking-wider text-left">
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold text-center">Active</th>
              <th className="px-4 py-3 font-semibold text-center">Delivered</th>
              <th className="px-4 py-3 font-semibold">Last delivery</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const active = c.projects.filter((p) => p.stage !== "DELIVERED" && p.stage !== "CANCELLED").length;
              const delivered = c.projects.filter((p) => p.stage === "DELIVERED");
              const last = delivered.map((p) => p.deliveredAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
              return (
                <tr key={c.id} className="table-row align-top">
                  <td className="px-4 py-3">
                    <Link href={`/projects?client=${c.id}`} className="font-semibold text-primary-700 dark:text-primary-400 hover:underline">{c.name}</Link>
                    {c.notes && <div className="text-[11px] text-ink-400">{c.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600 dark:text-gray-400">
                    {c.contactName ?? "—"}
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div>{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-semibold">{active}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{delivered.length}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(last)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <details className="inline-block text-left">
                        <summary className="cursor-pointer text-xs font-semibold text-primary-600 list-none">Edit</summary>
                        <form action={saveClient} className="mt-2 w-72 space-y-2 p-3 card absolute right-8 z-10">
                          <input type="hidden" name="id" value={c.id} />
                          <input className="input" name="name" defaultValue={c.name} required />
                          <input className="input" name="contactName" defaultValue={c.contactName ?? ""} placeholder="Contact person" />
                          <input className="input" name="email" defaultValue={c.email ?? ""} placeholder="Email" />
                          <input className="input" name="phone" defaultValue={c.phone ?? ""} placeholder="Phone" />
                          <textarea className="input" name="notes" defaultValue={c.notes ?? ""} placeholder="Notes" rows={2} />
                          <SaveButton label="Save" />
                        </form>
                        {c.projects.length === 0 && (
                          <form action={deleteClient} className="mt-1">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="text-[11px] text-rose-600">Delete</button>
                          </form>
                        )}
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
