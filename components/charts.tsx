"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#9ca3af", fontWeight: 500 as const };
const GRID = "#f3f4f6";
const COLORS = ["#00BAF2", "#002970", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#f97316", "#84cc16"];
const tooltip = {
  contentStyle: { background: "rgba(255,255,255,0.95)", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, padding: "8px 14px" },
  cursor: { fill: "rgba(0,186,242,0.04)" },
};

export type Datum = { name: string; value: number; color?: string };
export type Series = { key: string; label: string; color: string };

function Panel({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="card p-5">
      <div className="section-title">{title}</div>
      {sub && <div className="text-[11px] text-ink-400 -mt-1 mb-2">{sub}</div>}
      <div className="h-64 mt-2">
        {empty ? <div className="h-full grid place-items-center text-sm text-ink-400">No data yet</div> : children}
      </div>
    </div>
  );
}

export function BarPanel({ title, sub, data, horizontal, unit }: { title: string; sub?: string; data: Datum[]; horizontal?: boolean; unit?: string }) {
  return (
    <Panel title={title} sub={sub} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 20 : 0, right: 10 }}>
          <CartesianGrid stroke={GRID} vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
            </>
          )}
          <Tooltip {...tooltip} formatter={(v) => [`${v}${unit ?? ""}`, title]} />
          <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36}>
            {data.map((d, i) => <Cell key={d.name} fill={d.color ?? COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function PiePanel({ title, sub, data }: { title: string; sub?: string; data: Datum[] }) {
  return (
    <Panel title={title} sub={sub} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
            {data.map((d, i) => <Cell key={d.name} fill={d.color ?? COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function LinePanel({ title, sub, data, series }: { title: string; sub?: string; data: Record<string, string | number>[]; series: Series[] }) {
  return (
    <Panel title={title} sub={sub} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}
