import { formatDate, isOpenStage } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";

export function DueCell({ dueDate, stage, isOverdue }: { dueDate: Date | null; stage: string; isOverdue: boolean }) {
  if (!dueDate) return <span className="text-ink-400 text-xs italic">No due date</span>;
  const d = daysUntil(dueDate);
  const open = isOpenStage(stage);
  return (
    <div>
      <div className="text-xs text-ink-700 dark:text-gray-300 whitespace-nowrap">{formatDate(dueDate)}</div>
      {isOverdue ? (
        <div className="text-[11px] font-semibold text-rose-600">{open ? `${Math.abs(d ?? 0)}d overdue` : "Delivered late"}</div>
      ) : open && d != null ? (
        <div className={`text-[11px] font-semibold ${d <= 3 ? "text-amber-600" : "text-ink-400"}`}>{d === 0 ? "Due today" : `${d}d left`}</div>
      ) : null}
    </div>
  );
}
