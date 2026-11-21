import React from "react";
import { useAuth } from "../../auth";
import { useI18n } from "../../i18n";
import { dateShort, fmtN, money, nOut, num } from "../../lib/format";
import { CompareLines } from "../../components/charts";
import { AssumptionBadge, Card, ModelBadge, Notice, Pill, RangeViz, Stat } from "../../components/ui";

function Col({ title, tone, sim, region, lang, limit, t }) {
  const s = sim.summary;
  const nitTone = limit && s.nitrate_mg_l != null ? (s.nitrate_mg_l > limit ? "risk" : "ok") : "neutral";
  return (
    <div className={`col ${tone === "rec" ? "good" : ""}`}>
      <h4><span className="dot" style={{ background: tone === "rec" ? "var(--c1)" : "var(--c2)" }} />{title}</h4>
      <dl className="kv">
        <dt>{t("nut.applied")}</dt><dd>{fmtN(s.n_applied, region, lang)}</dd>
        <dt>{t("nut.leached")}</dt><dd>{fmtN(s.n_leached, region, lang)}</dd>
        <dt>{t("nut.surplus")}</dt><dd>{fmtN(s.n_surplus, region, lang)}</dd>
        <dt>{t("nut.nitrate")}</dt><dd>{s.nitrate_mg_l == null ? "–" : <Pill tone={nitTone}>{num(s.nitrate_mg_l, lang, 0)}</Pill>}</dd>
        <dt>{t("nut.ece_max")}</dt><dd>{num(s.ece_max, lang, 1)} dS/m</dd>
        <dt>{t("nut.yield")}</dt><dd>{num(s.yield_rel, lang, 0)}%</dd>
      </dl>
    </div>
  );
}

export default function NutrientsSection({ a }) {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const f = a.fertilizer;
  const d = f.dose;
  const limit = a.nitrate_limit;
  const sv = f.savings;
  const overTone = d.over_pct == null ? "neutral" : d.over_pct > 40 ? "risk" : d.over_pct > 10 ? "warn" : "ok";

  return (
    <div className="stack">
      <Card title={t("nut.title")} sub={t("nut.sub")} right={<ModelBadge />}>
        <div className="grid cols-3">
          <Stat label={t("nut.dose")} value={`${num(nOut(d.low, region), lang, region.n_factor < 1 ? 1 : 0)} – ${num(nOut(d.high, region), lang, region.n_factor < 1 ? 1 : 0)}`} unit={region.n_unit} note={`≈ ${fmtN(d.mid, region, lang)}`} />
          <Stat label={t("nut.current")} value={num(nOut(d.current, region), lang, region.n_factor < 1 ? 1 : 0)} unit={region.n_unit} tone={overTone === "neutral" ? undefined : overTone} />
          <div className="stat"><div className="label">&nbsp;</div>
            {d.over_pct == null ? null : d.over_pct > 10 ? <Pill tone={overTone}>{t("nut.over", { pct: num(d.over_pct, lang, 0) })}</Pill> : d.over_pct < -10 ? <Pill tone="info">{t("nut.under")}</Pill> : <Pill tone="ok">{t("nut.ok_range")}</Pill>}
            {d.capped_by_guideline && <div style={{ marginTop: 6 }}><Pill tone="info">{t("nut.capped")}</Pill></div>}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <RangeViz low={d.low} high={d.high} mark={d.current} max={Math.max(d.current || 0, d.high)} bandLabel={`${t("nut.dose")}: ${fmtN(d.low, region, lang)} – ${fmtN(d.high, region, lang)}`} markLabel={`${t("nut.current")}: ${fmtN(d.current, region, lang)}`} />
        </div>
        <div className="row wrap tiny muted" style={{ gap: 18, marginTop: 6 }}>
          <span>{t("nut.supply")}: {fmtN(d.supply_kg_ha, region, lang)}</span>
          {d.guideline_cap && <span>{t("nut.cap")}: {fmtN(d.guideline_cap, region, lang)}</span>}
          <span>{f.known_soil_n ? t("nut.soil_known") : t("nut.soil_unknown")}</span>
        </div>
        {!f.known_soil_n && <Notice tone="warn">{t("nut.soil_unknown")}</Notice>}
      </Card>

      <Card title={t("nut.compare")} sub={t("nut.horizon", { n: f.horizon_days })} right={<AssumptionBadge />}>
        <div className="compare">
          <Col title={t("nut.current_p")} tone="cur" sim={f.sim_current} region={region} lang={lang} limit={limit} t={t} />
          <Col title={t("nut.rec_p")} tone="rec" sim={f.sim_recommended} region={region} lang={lang} limit={limit} t={t} />
        </div>
        {limit != null && <div className="tiny muted" style={{ marginTop: 8 }}>{t("nut.limit")}: {limit} mg N/L</div>}
        <Notice tone="info">{t("nut.nitrate_note")}</Notice>
      </Card>

      <div className="grid cols-2">
        <Card title={t("nut.chart_pool")} sub={t("nut.pool_unit").replace("kg N/ha", region.n_unit)}>
          <CompareLines cur={f.sim_current.series.map((x) => ({ ...x, n_min: nOut(x.n_min, region) }))} rec={f.sim_recommended.series.map((x) => ({ ...x, n_min: nOut(x.n_min, region) }))} keyName="n_min" unit={region.n_unit} labelCur={t("nut.current_p")} labelRec={t("nut.rec_p")} />
        </Card>
        <Card title={t("nut.chart_ece")} sub={t("nut.ece_unit")}>
          <CompareLines cur={f.sim_current.series} rec={f.sim_recommended.series} keyName="ece" unit="dS/m" labelCur={t("nut.current_p")} labelRec={t("nut.rec_p")} threshold={a.salinity.threshold_ece} thresholdLabel={t("sal.threshold_line")} />
        </Card>
      </div>
      <Notice tone="info"><div><b>{t("nut.tradeoff_t")}.</b> {t("nut.tradeoff_d")}</div></Notice>

      <div className="grid cols-2">
        <Card title={t("nut.schedule")}>
          {f.applications.length ? (
            <table className="t"><thead><tr><th>{t("nut.when")}</th><th className="n">{t("nut.amount")}</th></tr></thead><tbody>
              {f.applications.map((x, i) => <tr key={i}><td>{dateShort(x.date, lang)}</td><td className="n">{num(nOut(x.kg_n, region), lang, region.n_factor < 1 ? 2 : 1)} {region.n_unit}</td></tr>)}
            </tbody></table>
          ) : <p className="muted">{t("nut.no_apps")}</p>}
        </Card>
        <Card title={t("nut.savings")} sub={t("nut.savings_d")}>
          <div className="grid cols-2">
            <Stat label={t("nut.kg_saved")} value={num(sv.kg_n, lang, 0)} unit="kg N" />
            <Stat label={t("nut.cost_saved")} value={money(sv.cost, sv.currency, lang)} />
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>{t("nut.embedded")}: {num(sv.embedded_kwh, lang, 0)} kWh</div>
        </Card>
      </div>
    </div>
  );
}
