import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, Leaf, Plus, Sprout, TestTube2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { money, num } from "../lib/format";
import { AdviceItem } from "../components/Advice";
import { Card, Empty, ErrorNote, Notice, Spinner, Stat } from "../components/ui";
import RegionalScene from "../components/art/RegionalScene";

export default function Dashboard() {
  const { user, region } = useAuth();
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get("/dashboard").then(setData).catch(setError);
  useEffect(() => { load(); }, []);

  if (error) return <ErrorNote error={error} />;
  if (!data || !region) return <Spinner />;
  const { items, alerts, notifications = [], totals } = data;
  const isJP = region.id === "JP";
  const limit = region.standards?.nitrate_limit_mg_l_n;

  if (!items.length) {
    return (
      <Card>
        <Empty icon={Sprout} title={t("dash.empty_t")}>
          <p>{t("dash.empty_d")}</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
            <Link to="/plots?new=1" className="btn"><Plus size={16} />{t("dash.add_plot")}</Link>
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
      <section className="dashboard-hero pattern-seigaiha">
        <RegionalScene regionId={region.id} />
        <div className="dashboard-hero-scrim" />
        <div className="dashboard-hero-head">
          <div><p className="hero-kicker">{t("dash.sub", { n: totals.plots })}</p><h1>{t("dash.hello", { name: user.name })}</h1></div>
        </div>
        <div className="dashboard-kpis">
          <Card className="hero-kpi"><Stat label={t("dash.kpi_area")} value={num(totals.area_ha * region.area_factor, lang, 1)} unit={region.area_unit} note={`${totals.plots} ${t("dash.kpi_plots").toLowerCase()}`} /></Card>
          {isJP ? (
            <Card className="hero-kpi"><Stat label={t("dash.kpi_reduction")} value={reduction != null ? `−${num(Math.max(0, reduction), lang, 0)}%` : "–"} note={t("dash.kpi_reduction_note")} /></Card>
          ) : (
            <Card className="hero-kpi"><Stat label={t("dash.kpi_energy")} value={money(totals.annual_energy_cost, totals.currency, lang)} note={t("dash.kpi_energy_note")} /></Card>
          )}
          <Card className="hero-kpi"><Stat label={t("dash.kpi_n")} value={money(totals.saving_n_cost, totals.currency, lang)} note={`${num(totals.saving_n_kg, lang, 0)} kg N · ${t("dash.kpi_n_note")}`} /></Card>
          {isJP ? (
            <Card className="hero-kpi"><Stat label={t("dash.nitrate")} value={`${overLimit}/${items.length}`} note={`> ${limit} mg N/L`} tone={overLimit ? "risk" : "ok"} /></Card>
          ) : (
            <Card className="hero-kpi"><Stat label={t("dash.kpi_risk")} value={`${totals.at_risk}/${items.length}`} tone={totals.at_risk ? "risk" : "ok"} /></Card>
          )}
        </div>
      </section>

      {synthetic && <Notice tone="warn">{t("dash.weather_synthetic")}</Notice>}

      {notifications.length > 0 && (
        <Card title={t("dash.notifications_title")} sub={t("dash.notifications_sub")}>
          <div className="notification-list">
            {notifications.map((n, i) => {
              const Icon = n.kind === "irrigation" ? Droplets : n.kind === "soil" ? TestTube2 : Leaf;
              return (
                <Link key={`${n.code}-${n.plot_id}-${i}`} to={`/plots/${n.plot_id}`} className={`notification-item ${n.tone || "info"}`}>
                  <span className="notification-icon"><Icon size={18} aria-hidden /></span>
                  <div className="grow"><b>{n.plot_name}</b><div className="small">{t(`dash.notifications.${n.code}`, n.params || {})}</div></div>
                  <ArrowRight size={16} className="flip" aria-hidden />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

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
            <AdviceItem key={i} a={a} crops={region.crop_list} />
          ))}
        </div>
      </Card>

    </div>
  );
}
