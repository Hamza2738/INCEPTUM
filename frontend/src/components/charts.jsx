import React from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { useI18n } from "../i18n";
import { dateShort, num } from "../lib/format";

export const C = { c1: "#2a78d6", c2: "#eb6834", c3: "#1baf7a", c4: "#eda100", grid: "#e1e0d9", axis: "#898781", ink: "#52514e" };

const axisProps = { stroke: C.axis, tick: { fill: C.axis, fontSize: 11 }, tickLine: false };

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><i className={it.square ? "sq" : ""} style={{ background: it.color, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined, height: it.dashed ? 0 : undefined }} />{it.label}</span>
      ))}
    </div>
  );
}

function Tip({ active, payload, label, fmtLabel, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tt">
      <b>{fmtLabel ? fmtLabel(label) : label}</b>
      {payload.filter((p) => p.value != null && p.name).map((p) => (
        <div key={p.dataKey}><span className="dot" style={{ background: p.color || p.stroke, marginInlineEnd: 6 }} />{p.name}: <span className="num">{typeof p.value === "number" ? Math.round(p.value * 100) / 100 : p.value}{unit || ""}</span></div>
      ))}
    </div>
  );
}

// Water balance: depletion area + RAW trigger line + rain bars + planned irrigation bars
export function WaterChart({ series, raw }) {
  const { t, lang } = useI18n();
  const data = series.map((d) => ({ ...d, label: d.date, rain_bar: d.rain || 0, irr_bar: d.planned_gross || d.irr_net || 0 }));
  const todayIdx = series.findIndex((d) => d.future);
  return (
    <>
      <div className="chart" style={{ height: 260 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} tickFormatter={(v) => dateShort(v, lang)} minTickGap={32} />
            <YAxis {...axisProps} />
            <Tooltip content={<Tip fmtLabel={(l) => dateShort(l, lang)} unit=" mm" />} />
            {todayIdx > 0 && <ReferenceLine x={data[todayIdx].label} stroke={C.axis} strokeDasharray="3 3" />}
            <Bar isAnimationActive={false} dataKey="rain_bar" name={t("water.chart_rain")} fill={C.c1} opacity={0.55} radius={[3, 3, 0, 0]} barSize={6} />
            <Bar isAnimationActive={false} dataKey="irr_bar" name={t("water.chart_irr")} fill={C.c3} radius={[3, 3, 0, 0]} barSize={6} />
            <Line isAnimationActive={false} type="monotone" dataKey="dr" name={t("water.chart_dr")} stroke={C.c2} strokeWidth={2} dot={false} />
            <ReferenceLine y={raw} stroke={C.ink} strokeDasharray="5 4" label={{ value: t("water.chart_raw"), fill: C.ink, fontSize: 11, position: "insideTopRight" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ label: t("water.chart_dr"), color: C.c2 }, { label: t("water.chart_rain"), color: C.c1, square: true }, { label: t("water.chart_irr"), color: C.c3, square: true }]} />
    </>
  );
}

// Two lines (current vs recommended). Colour follows the entity: current = orange, recommended = blue.
export function CompareLines({ cur, rec, keyName, unit, labelCur, labelRec, threshold, thresholdLabel, height = 230 }) {
  const { lang } = useI18n();
  const n = Math.max(cur.length, rec.length);
  const data = Array.from({ length: n }, (_, i) => ({ date: (cur[i] || rec[i]).date, cur: cur[i] ? cur[i][keyName] : null, rec: rec[i] ? rec[i][keyName] : null }));
  return (
    <>
      <div className="chart" style={{ height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={(v) => dateShort(v, lang)} minTickGap={32} />
            <YAxis {...axisProps} />
            <Tooltip content={<Tip fmtLabel={(l) => dateShort(l, lang)} unit={` ${unit}`} />} />
            {threshold != null && <ReferenceLine y={threshold} stroke={C.ink} strokeDasharray="5 4" label={{ value: thresholdLabel, fill: C.ink, fontSize: 11, position: "insideTopRight" }} />}
            <Line isAnimationActive={false} type="monotone" dataKey="cur" name={labelCur} stroke={C.c2} strokeWidth={2} dot={false} />
            <Line isAnimationActive={false} type="monotone" dataKey="rec" name={labelRec} stroke={C.c1} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ label: labelCur, color: C.c2 }, { label: labelRec, color: C.c1 }]} />
    </>
  );
}

// Hourly pumping: baseline vs optimized bars + tariff line
export function HourlyChart({ series, labelBase, labelOpt, labelPrice, labelPv, forbidden = [], peak = [] }) {
  // The plan covers 7 days x 24 h. Show the average day so the shift between hours is easy to read.
  const days = Math.max(1, Math.round(series.hour.length / 24));
  const avg = (arr) => Array.from({ length: 24 }, (_, h) => { let s = 0; for (let d = 0; d < days; d++) s += arr[d * 24 + h] || 0; return Math.round((s / days) * 100) / 100; });
  const base = avg(series.x_base), opt = avg(series.x_opt), price = series.price.slice(0, 24), pvA = series.pv ? avg(series.pv) : null;
  const data = Array.from({ length: 24 }, (_, h) => ({ hour: h, base: base[h], opt: opt[h], price: price[h], pv: pvA ? pvA[h] : null }));
  const hasPv = pvA && pvA.some((v) => v > 0.001);
  return (
    <>
      <div className="chart" style={{ height: 270 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="hour" {...axisProps} tickFormatter={(h) => `${h}h`} interval={1} />
            <YAxis yAxisId="l" {...axisProps} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} hide />
            <Tooltip content={<Tip fmtLabel={(h) => `${h}:00`} />} />
            {forbidden.map((h) => <ReferenceArea key={`f${h}`} yAxisId="l" x1={h - 0.5} x2={h + 0.5} fill="#898781" fillOpacity={0.12} />)}
            <Bar isAnimationActive={false} yAxisId="l" dataKey="base" name={labelBase} fill={C.c2} radius={[3, 3, 0, 0]} barSize={7} />
            <Bar isAnimationActive={false} yAxisId="l" dataKey="opt" name={labelOpt} fill={C.c1} radius={[3, 3, 0, 0]} barSize={7} />
            <Line isAnimationActive={false} yAxisId="r" type="stepAfter" dataKey="price" name={labelPrice} stroke={C.ink} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ label: labelBase, color: C.c2, square: true }, { label: labelOpt, color: C.c1, square: true }, { label: labelPrice, color: C.ink, dashed: true }]} />
      {hasPv && <div className="tiny muted" style={{ marginTop: 4 }}>{labelPv}</div>}
    </>
  );
}

export function Histogram({ hist, currency, lang }) {
  const data = hist.map((b) => ({ x: b.x, n: b.n }));
  const zeroIdx = data.findIndex((d) => d.x >= 0);
  return (
    <div className="chart" style={{ height: 230 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" {...axisProps} tickFormatter={(v) => new Intl.NumberFormat("en", { notation: "compact" }).format(v)} minTickGap={32} />
          <YAxis {...axisProps} />
          <Tooltip content={<Tip fmtLabel={(v) => `${num(v, lang)} ${currency}`} />} />
          <Bar isAnimationActive={false} dataKey="n" name="runs" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.x < 0 ? C.c2 : C.c1} />)}
          </Bar>
          {zeroIdx > 0 && <ReferenceLine x={data[zeroIdx].x} stroke={C.ink} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Tornado({ rows, base, labels, currency, lang }) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  const data = sorted.map((r) => ({ name: labels[r.driver] || r.driver, down: Math.min(r.low, r.high) - base, up: Math.max(r.low, r.high) - base }));
  return (
    <div className="chart" style={{ height: 40 + data.length * 38 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 16, left: 20, bottom: 0 }} barSize={16}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => new Intl.NumberFormat(lang, { notation: "compact" }).format(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={110} />
          <Tooltip content={<Tip unit={` ${currency}`} />} />
          <ReferenceLine x={0} stroke={C.ink} />
          <Bar isAnimationActive={false} dataKey="down" name="−20%" stackId="s" fill={C.c2} radius={[3, 0, 0, 3]} />
          <Bar isAnimationActive={false} dataKey="up" name="+20%" stackId="s" fill={C.c1} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlow({ flows, currency, lang, labelYear }) {
  const data = flows.map((f, i) => ({ year: typeof f === "number" ? i + 1 : f.year ?? i + 1, v: typeof f === "number" ? f : f.net ?? f.cash ?? f.value ?? 0 }));
  return (
    <div className="chart" style={{ height: 210 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v) => new Intl.NumberFormat(lang, { notation: "compact" }).format(v)} />
          <Tooltip content={<Tip fmtLabel={(y) => `${labelYear} ${y}`} unit={` ${currency}`} />} />
          <ReferenceLine y={0} stroke={C.ink} />
          <Bar isAnimationActive={false} dataKey="v" name={currency} radius={[3, 3, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.v < 0 ? C.c2 : C.c1} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
