import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { createProject } from "../actions";
import { ProjectIntakeForm } from "./form";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!can(session.user, "project:create")) {
    return <div className="card p-6">You don&apos;t have permission to create projects.</div>;
  }

  const [clients, projectTypes, users] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.projectType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, roles: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  const withRole = (r: string) => users.filter((u) => (u.roles || u.role).split(",").some((x) => x.trim() === r || x.trim() === "ADMIN"));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">New Project</h1>
        <p className="page-sub">Capture the brief. Tasks, deliverables and files can be added on the project page.</p>
      </div>
      <ProjectIntakeForm
        action={createProject}
        clients={clients}
        projectTypes={projectTypes}
        editors={withRole("EDITOR").map(({ id, name }) => ({ id, name }))}
        reviewers={withRole("REVIEWER").map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
