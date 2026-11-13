import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { addProjectType, deleteProjectType } from "./actions";

export default async function LookupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!can(session.user, "lookup:manage")) return <div className="card p-6">Forbidden.</div>;

  const types = await db.projectType.findMany({ include: { _count: { select: { projects: true } } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="page-title">Project Types</h1>
        <p className="page-sub">The kinds of video work HL Media takes on. Types in use can&apos;t be deleted.</p>
      </div>

      <form action={addProjectType} className="card p-4 flex items-end gap-3">
        <div className="flex-1"><label className="label">New project type</label><input className="input" name="name" placeholder="e.g. Music Video" required /></div>
        <button className="btn-primary">+ Add</button>
      </form>

      <div className="card p-2">
        <ul className="text-sm divide-y divide-ink-100 dark:divide-white/[0.04]">
          {types.map((t) => (
            <li key={t.id} className="px-3 py-2.5 flex items-center justify-between">
              <span className="font-medium">{t.name}</span>
              <span className="flex items-center gap-4">
                <span className="text-xs text-ink-400">{t._count.projects} projects</span>
                {t._count.projects === 0 && (
                  <form action={deleteProjectType}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs text-red-600 hover:underline">Delete</button>
                  </form>
                )}
              </span>
            </li>
          ))}
          {types.length === 0 && <li className="px-3 py-6 text-center text-ink-400">No project types yet.</li>}
        </ul>
      </div>
    </div>
  );
}
