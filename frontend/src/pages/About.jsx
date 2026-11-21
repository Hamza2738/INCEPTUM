import React, { useEffect, useState } from "react";
import { BrainCircuit, Calculator, Database, ExternalLink, ShieldAlert } from "lucide-react";
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
      <div className="grid cols-2">
        <Card title={t("about.computed_t")}><div className="row" style={{ alignItems: "flex-start" }}><Calculator size={22} aria-hidden /><p style={{ margin: 0 }}>{t("about.computed")}</p></div></Card>
        <Card title={t("about.ai_t")}><div className="row" style={{ alignItems: "flex-start" }}><BrainCircuit size={22} aria-hidden /><p style={{ margin: 0 }}>{t("about.ai")}</p></div></Card>
      </div>
      <Card title={t("about.honest_t")}>
        <div className="stack tight">{["h1", "h2", "h3", "h4", "h5", "h6"].map((k) => <Notice key={k} tone="warn" icon={ShieldAlert}>{t(`about.${k}`)}</Notice>)}</div>
      </Card>
      <Card title={t("about.assumptions_t")}>
        {plots.length > 0 && <Field label={t("about.pick_plot")}><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <ul style={{ margin: "12px 0 0", paddingInlineStart: 20 }}>{assumptions.map((x, i) => <li key={i} className="small" style={{ marginBottom: 4 }}>{x}</li>)}</ul>
      </Card>
      <div className="grid cols-2">
        <Card title={t("about.data_t")}><div className="row" style={{ alignItems: "flex-start" }}><Database size={22} aria-hidden /><p style={{ margin: 0 }}>{t("about.data")}</p></div></Card>
        <Card title={t("about.links")}>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>{(region.sources || []).map((s) => <li key={s.url} className="small" style={{ marginBottom: 6 }}><a href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={11} aria-hidden /></a></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
