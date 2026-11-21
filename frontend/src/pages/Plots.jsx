import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FlaskConical, Plus, Sprout, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { fmtArea, pick } from "../lib/format";
import PlotForm from "../components/PlotForm";
import { Button, Card, Empty, ErrorNote, Spinner, useToast } from "../components/ui";

export default function Plots() {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [plots, setPlots] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [, toast, toastEl] = useToast();

  const load = () => api.get("/plots").then((r) => setPlots(r.plots)).catch(setError);
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(t("plots.delete_confirm"))) return;
    await api.del(`/plots/${p.id}`);
    load();
  };
  const demo = async () => { await api.post("/plots/demo"); toast(t("plots.demo_loaded")); load(); };

  if (error) return <ErrorNote error={error} />;
  if (!plots) return <Spinner />;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>{t("plots.title")}</h1><p>{t("plots.sub")}</p></div>
        {!creating && <div className="row"><Button className="ghost" onClick={demo}><FlaskConical size={16} />{t("dash.load_demo")}</Button><Button onClick={() => setCreating(true)}><Plus size={16} />{t("plots.new")}</Button></div>}
      </div>

      {creating && (
        <Card title={t("plots.new")}>
          <PlotForm onCancel={() => { setCreating(false); setParams({}); }} onSaved={(p) => { toast(t("plots.created")); nav(`/plots/${p.id}`); }} />
        </Card>
      )}

      {!plots.length && !creating && <Card><Empty icon={Sprout} title={t("dash.empty_t")}>{t("dash.empty_d")}</Empty></Card>}

      <div className="grid auto">
        {plots.map((p) => {
          const crop = region.crop_list.find((c) => c.id === p.crop_id);
          return (
            <Card key={p.id}>
              <h3>{p.name}</h3>
              <div className="muted small" style={{ marginBottom: 12 }}>{crop ? pick(crop.name, lang) : p.crop_id} · {fmtArea(p.area_ha, region, lang)} · ECw {p.water_ec} dS/m</div>
              <div className="row between">
                <Link className="btn ghost sm" to={`/plots/${p.id}`}>{t("plots.open")} <ArrowRight size={14} className="flip" /></Link>
                <button className="btn danger sm" onClick={() => remove(p)} aria-label={t("delete")}><Trash2 size={14} /></button>
              </div>
            </Card>
          );
        })}
      </div>
      {toastEl}
    </div>
  );
}
