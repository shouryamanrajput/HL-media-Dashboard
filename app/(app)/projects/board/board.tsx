"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { STAGE_LABELS, priorityColor, PRIORITY_LABELS } from "@/lib/utils";

export type BoardCard = {
  id: string;
  code: string;
  title: string;
  stage: string;
  priority: string;
  client: string | null;
  editor: string | null;
  due: string | null;
  isOverdue: boolean;
  tasksDone: number;
  tasksTotal: number;
  canMove: boolean;
};

export function Board({ cards, stages, move }: { cards: BoardCard[]; stages: string[]; move: (id: string, stage: string) => Promise<void> }) {
  const [optimistic, setOptimistic] = useOptimistic(cards, (state, upd: { id: string; stage: string }) =>
    state.map((c) => (c.id === upd.id ? { ...c, stage: upd.stage } : c)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(stage: string) {
    const card = optimistic.find((c) => c.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (!card || card.stage === stage) return;
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: card.id, stage });
      try {
        await move(card.id, stage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not move the project.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl px-4 py-2 text-sm bg-rose-50 text-rose-700 border border-rose-200/50">{error}</div>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = optimistic.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => drop(stage)}
              className={`w-64 shrink-0 rounded-2xl p-2.5 transition-colors ${overStage === stage ? "bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-200" : "bg-ink-100/50 dark:bg-white/[0.03]"}`}
            >
              <div className="flex items-center justify-between px-1.5 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-gray-400">{STAGE_LABELS[stage]}</span>
                <span className="text-[11px] font-semibold text-ink-400">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable={c.canMove}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`card p-3 ${c.canMove ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/projects/${c.id}`} className="text-[11px] font-semibold text-primary-700 dark:text-primary-400 hover:underline">{c.code}</Link>
                      <span className={`badge !px-1.5 text-[10px] ${priorityColor(c.priority)}`}>{PRIORITY_LABELS[c.priority]}</span>
                    </div>
                    <Link href={`/projects/${c.id}`} className="block text-sm font-medium text-ink-900 dark:text-gray-200 mt-1 leading-snug hover:text-primary-700">{c.title}</Link>
                    {c.client && <div className="text-[11px] text-ink-400 mt-0.5">{c.client}</div>}
                    <div className="flex items-center justify-between mt-2 text-[11px]">
                      <span className="text-ink-500">{c.editor ?? "Unassigned"}</span>
                      <span className={c.isOverdue ? "font-semibold text-rose-600" : "text-ink-400"}>{c.due ?? ""}</span>
                    </div>
                    {c.tasksTotal > 0 && (
                      <div className="mt-2 h-1 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(c.tasksDone / c.tasksTotal) * 100}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
