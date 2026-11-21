import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Droplets, Leaf, Plus, Sprout, FlaskConical } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { fmtArea, fmtN, money, num, pick, VERDICT_TONE } from "../lib/format";
import { AdviceItem } from "../components/Advice";
import { Button, Card, Empty, ErrorNote, Notice, Pill, Spinner, Stat } from "../components/ui";

export default function Dashboard() {
  const { user, region } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/dashboard").then(setData).catch(setError);
  useEffect(() => { load(); }, []);

  const demo = async () => { setBusy(true); try { await api.post("/plots/demo"); await load(); } catch (e) { setError(e); } finally { setBusy(false); } };

  if (error) return <ErrorNote error={error} />;
  if (!data || !region) return <Spinner />;
  const { items, alerts, totals } = data;
  const isJP = region.id === "JP";
  const limit = region.standards?.nitrate_limit_mg_l_n;

  if (!items.length) {
    return (
      <Card>
        <Empty icon={Sprout} title={t("dash.empty_t")}>
          <p>{t("dash.empty_d")}</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
            <Link to="/plots?new=1" className="btn"><Plus size={16} />{t("dash.add_plot")}</Link>
            <Button className="ghost" busy={busy} onClick={demo}><FlaskConical size={16} />{t("dash.load_demo")}</Button>
          </div>
        </Empty>
      </Card>
    );
  }

  const overLimit = limit ? items.filter((i) => i.nitrate_mg_l != null && i.nitrate_mg_l > limit).length : 0;
  const synthetic = items.some((i) => (i.warnings || []).some((w) => w.code === "weather_synthetic"));
  const reduction = totals.fertilizer_reduction_pct;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>{t("dash.hello", { name: user.name })}</h1><p>{t("dash.sub", { n: totals.plots })}</p></div>
        <Link to="/plots?new=1" className="btn"><Plus size={16} />{t("dash.add_plot")}</Link>
      </div>

      {synthetic && <Notice tone="warn">{t("dash.weather_synthetic")}</Notice>}

      <div className="grid cols-4">
        <Card><Stat label={t("dash.kpi_area")} value={num(totals.area_ha * region.area_factor, lang, 1)} unit={region.area_unit} note={`${totals.plots} ${t("dash.kpi_plots").toLowerCase()}`} /></Card>
        {isJP ? (
          <Card><Stat label={t("dash.kpi_reduction")} value={reduction != null ? `−${num(Math.max(0, reduction), lang, 0)}%` : "–"} note={t("dash.kpi_reduction_note")} /></Card>
        ) : (
          <Card><Stat label={t("dash.kpi_energy")} value={money(totals.annual_energy_cost, totals.currency, lang)} note={t("dash.kpi_energy_note")} /></Card>
        )}
        <Card><Stat label={t("dash.kpi_n")} value={money(totals.saving_n_cost, totals.currency, lang)} note={`${num(totals.saving_n_kg, lang, 0)} kg N · ${t("dash.kpi_n_note")}`} /></Card>
        {isJP ? (
          <Card><Stat label={t("dash.nitrate")} value={`${overLimit}/${items.length}`} note={`> ${limit} mg N/L`} tone={overLimit ? "risk" : "ok"} /></Card>
        ) : (
          <Card><Stat label={t("dash.kpi_risk")} value={`${totals.at_risk}/${items.length}`} tone={totals.at_risk ? "risk" : "ok"} /></Card>
        )}
      </div>

      {isJP && region.policy && (
        <Card tint>
          <div className="row between wrap">
            <div style={{ maxWidth: 640 }}><h3>{t("dash.policy_t")}</h3><p className="small" style={{ margin: "4px 0 0" }}>{t("dash.policy_d")}</p></div>
            <div style={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
              <div className="row between tiny"><span>0%</span><span>−{region.policy.chem_fertilizer_reduction_2030_pct}% (2030)</span></div>
              <div className="bar" aria-hidden><i style={{ width: `${Math.min(100, Math.max(0, (reduction || 0) / region.policy.chem_fertilizer_reduction_2030_pct * 100))}%` }} /></div>
            </div>
          </div>
        </Card>
      )}
      {!isJP && <Card tint><h3>{t("dash.tn_note_t")}</h3><p className="small" style={{ margin: "4px 0 0" }}>{t("dash.tn_note_d")}</p></Card>}

      <Card title={t("dash.priorities")} sub={t("dash.priorities_sub")}>
        {alerts.length === 0 && <Notice tone="ok">{t("dash.all_good")}</Notice>}
        <div className="stack tight">
          {alerts.map((a, i) => (
            <div key={i}>
              <div className="row tiny muted" style={{ marginBottom: 3 }}><Leaf size={12} aria-hidden />{a.plot_name}</div>
              <AdviceItem a={a} crops={region.crop_list} />
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 style={{ marginBottom: 12 }}>{t("dash.plots")}</h2>
        <div className="grid auto">
          {items.map((i) => {
            const tone = VERDICT_TONE[i.verdict] || "neutral";
            const nitTone = limit && i.nitrate_mg_l != null ? (i.nitrate_mg_l > limit ? "risk" : "ok") : null;
            return (
              <Card key={i.plot.id}>
                <div className="row between wrap" style={{ alignItems: "flex-start" }}>
                  <div><h3>{i.plot.name}</h3><div className="muted small">{pick(i.crop.name, lang)} · {fmtArea(i.plot.area_ha, region, lang)}</div></div>
                  <Pill tone={tone}>{t(`sal.short.${i.verdict}`)}</Pill>
                </div>
                <dl className="kv" style={{ margin: "14px 0" }}>
                  <dt><Droplets size={13} style={{ verticalAlign: -2 }} aria-hidden /> {t("dash.water_need")}</dt><dd>{num(i.today_need_mm, lang, 1)} mm</dd>
                  <dt>{t("dash.n_over")}</dt><dd>{i.over_pct == null ? "–" : i.over_pct > 0 ? `+${num(i.over_pct, lang, 0)}%` : `${num(i.over_pct, lang, 0)}%`}</dd>
                  {isJP ? (<><dt>{t("dash.nitrate")}</dt><dd>{i.nitrate_mg_l == null ? "–" : <Pill tone={nitTone || "neutral"}>{num(i.nitrate_mg_l, lang, 0)} mg/L</Pill>}</dd></>)
                    : (<><dt>{t("nrg.annual_cost")}</dt><dd>{money(i.annual_cost, region.currency, lang)}</dd></>)}
                </dl>
                <Link to={`/plots/${i.plot.id}`} className="btn ghost sm">{t("dash.open")} <ArrowRight size={14} className="flip" /></Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
