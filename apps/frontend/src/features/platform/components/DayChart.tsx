import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayCount } from "shared-types";
import { fmtDay, fmtInt } from "../format";

const LINE = "#60a5fa"; // --color-brand: one series, so one hue; the card title names it

/** Per-day counts for 30 days: one line, a hover crosshair + tooltip. */
export function DayChart({ data, unit }: { data: DayCount[]; unit: string }) {
  return (
    <div className="mt-4 h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={`fill-${unit}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={LINE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1a1a1a" />
          <XAxis
            dataKey="day"
            tickFormatter={fmtDay}
            tick={{ fill: "#71717a", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#262626" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis allowDecimals={false} tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: "#3f3f46" }}
            contentStyle={{ background: "#161616", border: "1px solid #27272a", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa" }}
            itemStyle={{ color: "#fafafa" }}
            labelFormatter={(d) => fmtDay(String(d))}
            formatter={(v) => [fmtInt(Number(v)), unit]}
          />
          <Area type="linear" dataKey="count" stroke={LINE} strokeWidth={2} fill={`url(#fill-${unit})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "#0f0f0f" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
