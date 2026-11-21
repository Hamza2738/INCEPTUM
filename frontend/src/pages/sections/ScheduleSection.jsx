import React, { useState } from "react";
import { useI18n } from "../../i18n";
import { money, num } from "../../lib/format";
import { HourlyChart } from "../../components/charts";
import { AssumptionBadge, Card, ModelBadge, Notice, Pill, Stat } from "../../components/ui";

export default function ScheduleSection({ a }) {
  const { t, lang } = useI18n();
  const o = a.optimizer;
  const hasSolar = a.energy.pv_kw > 0 && o.with_solar && !o.with_solar.empty;
  const [mode, setMode] = useState("no_solar");
  const cur = o.currency;
  const m = hasSolar && mode === "with_solar" ? o.with_solar : o.no_solar;

  return (
    <div className="stack">
      <Card title={t("opt.title")} sub={t("opt.sub")} right={<ModelBadge />}>
        {hasSolar && (
          <div className="row" style={{ marginBottom: 12 }}>
            <button className={`chip ${mode === "no_solar" ? "active" : ""}`} onClick={() => setMode("no_solar")}>{t("opt.nosolar")}</button>
            <button className={`chip ${mode === "with_solar" ? "active" : ""}`} onClick={() => setMode("with_solar")}>{t("opt.solar")}</button>
          </div>
        )}
        {m.empty ? <Notice tone="info">{t("opt.empty")}</Notice> : !m.feasible ? <Notice tone="warn">{t("opt.infeasible")}</Notice> : (
          <>
            <div className="grid cols-4">
              <Stat label={t("opt.saving")} value={`${num(m.saving_pct, lang, 0)}%`} tone={m.saving_pct > 0 ? "ok" : undefined} note={t("opt.cost")} />
              <Stat label={`${t("opt.baseline")}`} value={money(m.baseline.cost, cur, lang)} note={`${num(m.baseline.kwh_grid, lang, 0)} kWh · ${num(m.baseline.peak_kw, lang, 1)} kW`} />
              <Stat label={`${t("opt.optimized")}`} value={money(m.optimized.cost, cur, lang)} note={`${num(m.optimized.kwh_grid, lang, 0)} kWh · ${num(m.optimized.peak_kw, lang, 1)} kW`} />
              <Stat label={t("opt.peak")} value={`${num(m.optimized.peak_kw, lang, 1)} kW`} note={`${t("opt.baseline")}: ${num(m.baseline.peak_kw, lang, 1)} kW`} />
            </div>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 6 }}>{t("opt.chart")}</h4>
              <HourlyChart series={m.series} labelBase={t("opt.pump_base")} labelOpt={t("opt.pump_opt")} labelPrice={t("opt.price")} labelPv={`${t("opt.pv_prod")}: ${num(Math.max(...(m.series.pv || [0])), lang, 2)} kW max`} forbidden={o.forbidden_hours} peak={o.peak_hours} />
            </div>
            <div className="row wrap" style={{ gap: 18, marginTop: 10 }}>
              <span className="small muted">{t("opt.peak_hours")}: {o.peak_hours.map((h) => `${h}h`).join(", ")}</span>
              {o.forbidden_hours.length > 0 && <span className="small muted">{t("opt.forbidden")}: {o.forbidden_hours[0]}h – {o.forbidden_hours[o.forbidden_hours.length - 1] + 1}h</span>}
              <AssumptionBadge />
            </div>
          </>
        )}
        <p className="tiny muted" style={{ marginTop: 10 }}>{t("opt.note")}</p>
      </Card>
    </div>
  );
}
