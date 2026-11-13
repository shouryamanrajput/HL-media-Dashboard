import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function toInputDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function projectCode(projectNo: number) {
  return `HLM-${String(projectNo).padStart(4, "0")}`;
}

export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  REVIEWER: "Reviewer",
};

export const ROLE_OPTIONS: [string, string][] = [
  ["ADMIN", "Admin"],
  ["EDITOR", "Editor"],
  ["REVIEWER", "Reviewer"],
];

export const PRIORITY_LIST = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const STAGE_LIST = [
  "BRIEF",
  "PRE_PRODUCTION",
  "FOOTAGE_RECEIVED",
  "EDITING",
  "INTERNAL_REVIEW",
  "REVISIONS",
  "FINAL_EXPORT",
  "DELIVERED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  BRIEF: "Brief received",
  PRE_PRODUCTION: "Pre-production",
  FOOTAGE_RECEIVED: "Footage received",
  EDITING: "Editing",
  INTERNAL_REVIEW: "Internal review",
  REVISIONS: "Revisions",
  FINAL_EXPORT: "Final export",
  DELIVERED: "Delivered",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

/** Stages shown as columns on the board and as steps in the project journey. */
export const PIPELINE_STAGES = STAGE_LIST.filter((s) => s !== "ON_HOLD" && s !== "CANCELLED");

export const CLOSED_STAGES = ["DELIVERED", "CANCELLED"];
export function isOpenStage(stage: string) {
  return !CLOSED_STAGES.includes(stage);
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export const TASK_STATUS_LIST = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export const DELIVERABLE_STATUS_LIST = ["PENDING", "IN_PROGRESS", "READY", "DELIVERED"] as const;
export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  READY: "Ready",
  DELIVERED: "Delivered",
};

export const ASSET_KIND_LIST = ["RAW", "DRAFT", "FINAL", "REFERENCE", "OTHER"] as const;
export const ASSET_KIND_LABELS: Record<string, string> = {
  RAW: "Raw footage",
  DRAFT: "Draft",
  FINAL: "Final",
  REFERENCE: "Reference",
  OTHER: "Other",
};

export const SOURCE_LIST = ["Referral", "Website", "Instagram", "Repeat client", "Other"];
export const PLATFORM_LIST = ["YouTube", "Instagram", "Facebook", "LinkedIn", "TikTok", "Website", "TV / OTT", "Other"];
export const ASPECT_RATIO_LIST = ["16:9", "9:16", "1:1", "4:5", "21:9"];

export function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "long" });
}

export function priorityColor(p: string) {
  return (
    {
      LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
      MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
      HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
      URGENT: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
    }[p] ?? "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60"
  );
}

export function stageColor(s: string) {
  return (
    {
      BRIEF: "bg-gray-100 text-gray-600 ring-1 ring-gray-200/60",
      PRE_PRODUCTION: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
      FOOTAGE_RECEIVED: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/60",
      EDITING: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
      INTERNAL_REVIEW: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
      REVISIONS: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
      FINAL_EXPORT: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
      DELIVERED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
      ON_HOLD: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
      CANCELLED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
    }[s] ?? "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60"
  );
}

export const STAGE_CHART_COLORS: Record<string, string> = {
  BRIEF: "#94a3b8",
  PRE_PRODUCTION: "#38bdf8",
  FOOTAGE_RECEIVED: "#22d3ee",
  EDITING: "#8b5cf6",
  INTERNAL_REVIEW: "#f59e0b",
  REVISIONS: "#f97316",
  FINAL_EXPORT: "#6366f1",
  DELIVERED: "#10b981",
  ON_HOLD: "#64748b",
  CANCELLED: "#ef4444",
};

export function reviewStatusColor(s: string) {
  return (
    {
      CHANGES_REQUESTED: "bg-rose-50 text-rose-700",
      APPROVED: "bg-emerald-50 text-emerald-700",
    }[s] ?? "bg-gray-50 text-gray-600"
  );
}

export function taskStatusColor(s: string) {
  return (
    {
      TODO: "bg-gray-100 text-gray-600",
      IN_PROGRESS: "bg-violet-50 text-violet-700",
      IN_REVIEW: "bg-amber-50 text-amber-700",
      DONE: "bg-emerald-50 text-emerald-700",
    }[s] ?? "bg-gray-50 text-gray-600"
  );
}

export function deliverableStatusColor(s: string) {
  return (
    {
      PENDING: "bg-gray-100 text-gray-600",
      IN_PROGRESS: "bg-violet-50 text-violet-700",
      READY: "bg-sky-50 text-sky-700",
      DELIVERED: "bg-emerald-50 text-emerald-700",
    }[s] ?? "bg-gray-50 text-gray-600"
  );
}
