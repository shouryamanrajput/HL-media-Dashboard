import type { User } from "@prisma/client";

export type Role = "ADMIN" | "EDITOR" | "REVIEWER";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string; // primary role (backward compat)
  roles: string; // comma-separated: "ADMIN,REVIEWER"
  scopeEntity?: string | null;
  scopeDept?: string | null;
};
// Compat: User pick used to be the source; keep both shapes assignable.
export type SessionUserFromDb = Pick<User, "id" | "email" | "name" | "role" | "roles" | "scopeEntity" | "scopeDept">;

export type Action =
  | "project:create"
  | "project:edit-any"
  | "project:edit-assigned"
  | "project:view"
  | "project:import"
  | "project:export"
  | "project:assign"
  | "project:delete"
  | "project:submit-for-review"
  | "project:review"
  | "task:create"
  | "task:edit-any"
  | "client:manage"
  | "user:manage"
  | "request:manage"
  | "lookup:manage"
  | "audit:view-any";

const MATRIX: Record<Action, Role[]> = {
  "project:create": ["ADMIN", "EDITOR"],
  "project:edit-any": ["ADMIN"],
  "project:edit-assigned": ["ADMIN", "EDITOR"],
  "project:view": ["ADMIN", "EDITOR", "REVIEWER"],
  "project:import": ["ADMIN"],
  "project:export": ["ADMIN", "EDITOR", "REVIEWER"],
  "project:assign": ["ADMIN"],
  "project:delete": ["ADMIN"],
  "project:submit-for-review": ["ADMIN", "EDITOR"],
  "project:review": ["ADMIN", "REVIEWER"],
  "task:create": ["ADMIN", "EDITOR", "REVIEWER"],
  "task:edit-any": ["ADMIN"],
  "client:manage": ["ADMIN", "EDITOR"],
  "user:manage": ["ADMIN"],
  "request:manage": ["ADMIN"],
  "lookup:manage": ["ADMIN"],
  "audit:view-any": ["ADMIN", "REVIEWER"],
};

export function userRoles(user: Pick<SessionUser, "role" | "roles">): string[] {
  return (user.roles || user.role || "").split(",").map((r) => r.trim()).filter(Boolean);
}

export function hasRole(user: Pick<SessionUser, "role" | "roles">, role: Role): boolean {
  return userRoles(user).includes(role);
}

export function can(user: SessionUser | null | undefined, action: Action): boolean {
  if (!user) return false;
  const roles = userRoles(user);
  return MATRIX[action]?.some((r) => roles.includes(r)) ?? false;
}

/** Prisma `where` filter for the projects a user may see. Editors see projects they edit or have tasks on. */
export function projectVisibilityFilter(user: SessionUser) {
  const roles = userRoles(user);
  if (roles.includes("ADMIN") || roles.includes("REVIEWER")) return {};
  return { OR: [{ editorId: user.id }, { tasks: { some: { assigneeId: user.id } } }] };
}

/** "My view" filter: projects the user is directly involved in, regardless of role. */
export function myProjectsFilter(user: SessionUser) {
  return {
    OR: [
      { editorId: user.id },
      { reviewerId: user.id },
      { tasks: { some: { assigneeId: user.id } } },
    ],
  };
}

export function canViewProject(
  user: SessionUser,
  project: { editorId?: string | null; tasks?: { assigneeId: string | null }[] },
): boolean {
  const roles = userRoles(user);
  if (roles.includes("ADMIN") || roles.includes("REVIEWER")) return true;
  if (project.editorId === user.id) return true;
  return project.tasks?.some((t) => t.assigneeId === user.id) ?? false;
}

export function canEditProject(user: SessionUser, project: { editorId?: string | null }): boolean {
  return can(user, "project:edit-any") || (can(user, "project:edit-assigned") && project.editorId === user.id);
}
