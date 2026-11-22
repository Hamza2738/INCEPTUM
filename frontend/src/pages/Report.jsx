import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { dateLong, fmtArea, fmtN, money, nOut, num, pick } from "../lib/format";
import { AdviceList } from "../components/Advice";
import { Button, Card, ErrorNote, KV, Notice, Spinner } from "../components/ui";

// Printable one-page summary. Use the browser's "Save as PDF".
export default function Report() {
  const { id } = useParams();
  const { region, user } = useAuth();
  const { t, lang } = useI18n();
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get(`/plots/${id}/analysis`).then(setA).catch(setError); }, [id]);
  if (error) return <ErrorNote error={error} />;
  if (!a) return <Spinner />;
  const s = a.salinity, f = a.fertilizer, e = a.energy, d = f.dose;

  return (
    <div className="stack">
      <div className="row between no-print"><Link to={`/plots/${id}`} className="btn ghost sm"><ArrowLeft size={14} className="flip" />{t("back")}</Link><Button onClick={() => window.print()}><Printer size={16} />{t("print")}</Button></div>
      <div>
        <div className="tiny muted">{t("app_name")} · {t("report.title")} · {t("report.generated")} {dateLong(a.today, lang)} · {user.name}</div>
        <h1>{a.plot.name}</h1>
        <p className="muted">{pick(a.crop.name, lang)} · {fmtArea(a.plot.area_ha, region, lang)} · {t(`plots.types.${a.plot.irrigation_type}`)}</p>
      </div>
      <Card title={t("dash.priorities")}><AdviceList items={a.advice} crops={region.crop_list} /></Card>
      <div className="grid cols-2">
        <Card title={t("tabs.salinity")}>
          <KV rows={[[t("sal.ecw"), `${num(s.ecw, lang, 1)} dS/m`], [t("sal.ece"), `${num(s.ece_est, lang, 1)} dS/m`], [t("sal.thr"), `${num(s.threshold_ece, lang, 1)} dS/m`], [t("sal.yield"), `${num(s.yield_rel, lang, 0)}%`], [t("sal.lr"), s.lr != null ? `${num(s.lr * 100, lang, 0)}%` : "–"], [t("tabs.salinity"), t(`sal.verdict.${s.verdict}`)]]} />
        </Card>
        <Card title={t("tabs.nutrients")}>
          <KV rows={[[t("nut.dose"), `${num(nOut(d.low, region), lang, 0)} – ${num(nOut(d.high, region), lang, 0)} ${region.n_unit}`], [t("nut.current"), fmtN(d.current, region, lang)], [t("nut.savings"), money(f.savings.cost, f.savings.currency, lang)], [t("nut.nitrate"), f.sim_current.summary.nitrate_mg_l == null ? "–" : `${num(f.sim_current.summary.nitrate_mg_l, lang, 0)} mg N/L`]]} />
        </Card>
        <Card title={t("tabs.energy")}>
          <KV rows={[[t("nrg.total"), `${num(e.total_co2_kg_m3, lang, 2)} ${t("nrg.unit")}`], [t("nrg.annual_cost"), money(e.annual_cost, e.currency, lang)], [t("nrg.pv"), `${num(e.pv_kw, lang, 1)} kWp`], [t("nrg.payback"), e.payback_months_p50 ? `${num(e.payback_months_p50, lang, 0)} ${t("nrg.months")}` : t("nrg.never")]]} />
        </Card>
        <Card title={t("about.assumptions_t")}><ul style={{ margin: 0, paddingInlineStart: 18 }}>{(a.assumptions || []).map((x, i) => <li key={i} className="small">{x}</li>)}</ul></Card>
      </div>
      <Notice tone="warn">{t("report.disclaimer")}</Notice>
    </div>
  );
}
