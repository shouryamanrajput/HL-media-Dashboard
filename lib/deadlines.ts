import { isOpenStage } from "./utils";

/** Days before the due date at which a project counts as "due soon". */
export const DUE_SOON_DAYS = Number(process.env.DUE_SOON_DAYS ?? 3);

export type DeadlineInput = {
  receivedDate: Date | string;
  dueDate?: Date | string | null;
  deliveredAt?: Date | string | null;
  stage: string;
};

export type DeadlineResult = {
  daysOpen: number;
  turnaroundDays: number | null;
  isOverdue: boolean;
};

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeDeadline(input: DeadlineInput): DeadlineResult {
  const received = new Date(input.receivedDate);
  const due = input.dueDate ? new Date(input.dueDate) : null;
  const delivered = input.deliveredAt ? new Date(input.deliveredAt) : null;
  const now = new Date();

  if (delivered) {
    const turnaroundDays = daysBetween(received, delivered);
    return {
      daysOpen: turnaroundDays,
      turnaroundDays,
      isOverdue: !!due && startOfDay(delivered) > startOfDay(due),
    };
  }

  return {
    daysOpen: daysBetween(received, now),
    turnaroundDays: null,
    isOverdue: isOpenStage(input.stage) && !!due && startOfDay(now) > startOfDay(due),
  };
}

/** Whole days until the due date (negative when overdue), or null without a due date. */
export function daysUntil(due: Date | string | null | undefined): number | null {
  if (!due) return null;
  return daysBetween(startOfDay(new Date()), startOfDay(new Date(due)));
}

export function isDueSoon(due: Date | string | null | undefined, stage: string): boolean {
  const d = daysUntil(due);
  return isOpenStage(stage) && d != null && d >= 0 && d <= DUE_SOON_DAYS;
}
