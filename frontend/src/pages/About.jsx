import React, { useEffect, useState } from "react";
import { Calculator, ExternalLink, ShieldAlert, Sprout } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Card, Field, Notice } from "../components/ui";

export default function About() {
  const { region } = useAuth();
  const { t } = useI18n();
  const [plots, setPlots] = useState([]);
  const [pid, setPid] = useState("");
  const [assumptions, setAssumptions] = useState([]);

  useEffect(() => { api.get("/plots").then((r) => { setPlots(r.plots); if (r.plots[0]) setPid(String(r.plots[0].id)); }).catch(() => {}); }, []);
  useEffect(() => { if (pid) api.get(`/plots/${pid}/analysis`).then((a) => setAssumptions(a.assumptions || [])).catch(() => {}); }, [pid]);

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("about.title")}</h1><p>{t("about.sub")}</p></div></div>
      <Card title={t("about.simple_t")}>
        <div className="about-steps">
          <div className="about-step"><span className="about-step-number">1</span><div><Calculator size={20} aria-hidden /><h3>{t("about.step1_t")}</h3><p>{t("about.step1")}</p></div></div>
          <div className="about-step"><span className="about-step-number">2</span><div><Sprout size={20} aria-hidden /><h3>{t("about.step2_t")}</h3><p>{t("about.step2")}</p></div></div>
          <div className="about-step"><span className="about-step-number">3</span><div><ShieldAlert size={20} aria-hidden /><h3>{t("about.step3_t")}</h3><p>{t("about.step3")}</p></div></div>
        </div>
      </Card>
      <Notice tone="warn"><b>{t("about.caution_t")}</b><br />{t("about.caution")}</Notice>
      <Card title={t("about.assumptions_t")}>
        {plots.length > 0 && <Field label={t("about.pick_plot")}><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <ul style={{ margin: "12px 0 0", paddingInlineStart: 20 }}>{assumptions.map((x, i) => <li key={i} className="small" style={{ marginBottom: 4 }}>{x}</li>)}</ul>
      </Card>
      <div className="about-sources">
        <Card title={t("about.links")}>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>{(region.sources || []).map((s) => <li key={s.url} className="small" style={{ marginBottom: 6 }}><a href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={11} aria-hidden /></a></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
