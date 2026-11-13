export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/utils";
import { SaveButton } from "@/components/save-button";

async function updateMember(formData: FormData) {
  "use server";
  const s = await auth();
  if (!s?.user || !can(s.user, "user:manage")) throw new Error("FORBIDDEN");
  const v = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const cap = Number(v("capacityHours"));
  await db.user.update({
    where: { id: String(formData.get("id")) },
    data: { title: v("title"), department: v("department"), skills: v("skills"), capacityHours: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null },
  });
  revalidatePath("/team");
}

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const isAdmin = can(session.user, "user:manage");

  const members = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      assignedTasks: { where: { status: { not: "DONE" } }, select: { estimateHours: true, loggedHours: true } },
      editedProjects: { where: { stage: { notIn: ["DELIVERED", "CANCELLED"] } }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Team</h1>
        <p className="page-sub">Skills, weekly capacity and current load. Accounts and roles are managed under Administration → Users.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m) => {
          const remaining = m.assignedTasks.reduce((s, t) => s + Math.max(0, (t.estimateHours ?? 0) - t.loggedHours), 0);
          const load = m.capacityHours ? Math.round((remaining / m.capacityHours) * 100) : null;
          return (
            <div key={m.id} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white grid place-items-center font-bold text-xs">
                  {m.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-ink-900 dark:text-white truncate">{m.name}</div>
                  <div className="text-[11px] text-ink-400 truncate">
                    {m.title ?? (m.roles || m.role).split(",").map((r) => ROLE_LABELS[r.trim()] ?? r).join(" · ")}
                    {m.department ? ` · ${m.department}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(m.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span key={s} className="badge bg-primary-50 text-primary-700 text-[10px]">{s}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Projects" value={m.editedProjects.length} />
                <Mini label="Open tasks" value={m.assignedTasks.length} />
                <Mini label="Hours left" value={remaining.toFixed(1)} />
              </div>
              {load != null && (
                <div>
                  <div className="flex justify-between text-[11px] text-ink-500 mb-1"><span>Load vs {m.capacityHours}h/week</span><span className={load > 100 ? "text-rose-600 font-semibold" : ""}>{load}%</span></div>
                  <div className="h-1.5 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
                    <div className={`h-full ${load > 100 ? "bg-rose-500" : load > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, load)}%` }} />
                  </div>
                </div>
              )}
              {isAdmin && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-primary-600">Edit profile</summary>
                  <form action={updateMember} className="mt-2 grid grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input className="input" name="title" defaultValue={m.title ?? ""} placeholder="Job title" />
                    <input className="input" name="department" defaultValue={m.department ?? ""} placeholder="Team" />
                    <input className="input col-span-2" name="skills" defaultValue={m.skills ?? ""} placeholder="Skills, comma-separated" />
                    <input className="input" name="capacityHours" type="number" defaultValue={m.capacityHours ?? ""} placeholder="Hours / week" />
                    <SaveButton label="Save" />
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-ink-50 dark:bg-white/[0.03] py-2">
      <div className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
    </div>
  );
}
