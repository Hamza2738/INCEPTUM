import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Droplets, FileText, Pencil, SlidersHorizontal, Sprout, TestTube2, Waves, Zap } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { fmtArea, pick, VERDICT_TONE } from "../lib/format";
import { AdviceList } from "../components/Advice";
import PlotForm from "../components/PlotForm";
import { Button, Card, ErrorNote, Notice, Pill, Spinner, Tabs } from "../components/ui";
import WaterSection from "./sections/WaterSection";
import SalinitySection from "./sections/SalinitySection";
import NutrientsSection from "./sections/NutrientsSection";
import EnergySection from "./sections/EnergySection";
import ScheduleSection from "./sections/ScheduleSection";
import WhatIfSection from "./sections/WhatIfSection";
import DataSection from "./sections/DataSection";

export default function PlotDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(region.focus?.[0] === "nutrients" ? "nutrients" : region.focus?.[0] === "energy" ? "energy" : "water");
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => { setError(null); return api.get(`/plots/${id}/analysis`).then(setA).catch(setError); }, [id]);
  useEffect(() => { setA(null); load(); }, [load]);

  if (error) return <div className="stack"><Link to="/plots" className="btn ghost sm" style={{ alignSelf: "flex-start" }}><ArrowLeft size={14} className="flip" />{t("back")}</Link><ErrorNote error={error} /></div>;
  if (!a) return <Spinner />;

  const tabs = [
    { id: "water", label: t("tabs.water"), icon: Droplets },
    { id: "salinity", label: t("tabs.salinity"), icon: Waves },
    { id: "nutrients", label: t("tabs.nutrients"), icon: Sprout },
    { id: "energy", label: t("tabs.energy"), icon: Zap },
    { id: "schedule", label: t("tabs.schedule"), icon: Clock },
    { id: "whatif", label: t("tabs.whatif"), icon: SlidersHorizontal },
    { id: "data", label: t("tabs.data"), icon: TestTube2 },
  ];
  const p = a.plot;
  const warns = (a.warnings || []).filter((w) => w.code !== "paddy_not_modeled");

  return (
    <div className="stack">
      <div className="page-head detail-page-head">
        <div>
          <Link to="/plots" className="small" style={{ display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none" }}><ArrowLeft size={14} className="flip" />{t("nav.plots")}</Link>
          <h1 style={{ marginTop: 4 }}>{p.name}</h1>
          <p>{pick(a.crop.name, lang)} · {fmtArea(p.area_ha, region, lang)} · {t(`plots.types.${p.irrigation_type}`)} · ECw {p.water_ec} dS/m <Pill tone={VERDICT_TONE[a.salinity.verdict] || "neutral"}>{t(`sal.short.${a.salinity.verdict}`)}</Pill></p>
        </div>
        <div className="row no-print">
          <Button className="ghost" onClick={() => nav(`/plots/${p.id}/report`)}><FileText size={16} />{t("report.title")}</Button>
          <Button className="ghost" onClick={() => setEditing(!editing)}><Pencil size={16} />{t("edit")}</Button>
        </div>
      </div>

      {editing && (
        <Card title={t("plots.edit")}><PlotForm plot={p} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setA(null); load(); }} /></Card>
      )}

      {warns.map((w) => <Notice key={w.code} tone="warn">{t(`warn.${w.code}`)}</Notice>)}

      <Card title={t("dash.priorities")} sub={t("dash.priorities_sub")}>
        {a.advice.length ? <AdviceList items={a.advice} crops={region.crop_list} /> : <Notice tone="ok">{t("dash.all_good")}</Notice>}
      </Card>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "water" && <WaterSection a={a} />}
      {tab === "salinity" && <SalinitySection a={a} />}
      {tab === "nutrients" && <NutrientsSection a={a} />}
      {tab === "energy" && <EnergySection a={a} />}
      {tab === "schedule" && <ScheduleSection a={a} />}
      {tab === "whatif" && <WhatIfSection plot={p} />}
      {tab === "data" && <DataSection plot={p} onChange={load} />}
    </div>
  );
}
