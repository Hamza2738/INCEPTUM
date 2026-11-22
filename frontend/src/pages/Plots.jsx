import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Droplets, Leaf, Plus, Sprout, TestTube2, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { fmtArea, money, num, pick, VERDICT_TONE } from "../lib/format";
import PlotForm from "../components/PlotForm";
import { Button, Card, Empty, ErrorNote, Pill, Spinner, useToast } from "../components/ui";
import { CropGlyph } from "../components/art/CropGlyph";

export default function Plots() {
  const { region } = useAuth();
  const isJP = region.id === "JP";
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [plots, setPlots] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [, toast, toastEl] = useToast();

  // The dashboard endpoint returns each plot with its computed summary (status, water need, nitrogen, cost).
  const load = () => api.get("/dashboard").then((r) => setPlots(r.items)).catch(setError);
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(t("plots.delete_confirm"))) return;
    await api.del(`/plots/${p.id}`);
    load();
  };

  if (error) return <ErrorNote error={error} />;
  if (!plots) return <Spinner />;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>{t("plots.title")}</h1><p>{t("plots.sub")}</p></div>
        {!creating && <div className="row"><Button onClick={() => setCreating(true)}><Plus size={16} />{t("plots.new")}</Button></div>}
      </div>

      {creating && (
        <Card title={t("plots.new")}>
          <PlotForm onCancel={() => { setCreating(false); setParams({}); }} onSaved={(p) => { toast(t("plots.created")); nav(`/plots/${p.id}`); }} />
        </Card>
      )}

      {!plots.length && !creating && <Card><Empty icon={Sprout} title={t("dash.empty_t")}>{t("dash.empty_d")}</Empty></Card>}

      <div className="grid auto">
        {plots.map((i, index) => {
          const tone = VERDICT_TONE[i.verdict] || "neutral";
          const overPct = i.over_pct == null ? null : Math.max(-100, Math.min(100, i.over_pct));
          const markerPos = overPct == null ? 50 : 50 + (overPct / 2);
          return (
            <Card key={i.plot.id} className="plot-card" style={{ "--i": index }}>
              <Link className="plot-card-stretch" to={`/plots/${i.plot.id}`} aria-label={`${t("dash.open")}: ${i.plot.name}`} />
              <div className="plot-card-band">
                <div className="plot-crop-glyph"><CropGlyph cropId={i.crop?.id || i.plot?.crop_id} size={34} /></div>
                <Pill tone={tone}>{t(`sal.short.${i.verdict}`)}</Pill>
              </div>
              <div className="plot-card-body">
                <h3>{i.plot.name}</h3>
                <div className="plot-card-sub">{pick(i.crop.name, lang)} · {fmtArea(i.plot.area_ha, region, lang)}</div>
                <div className="plot-metrics">
                  <div className="plot-metric"><Droplets size={18} aria-hidden /><b className="num">{num(i.today_need_mm, lang, 1)} mm</b><span>{t("dash.water_need")}</span></div>
                  <div className="plot-metric"><Leaf size={18} aria-hidden /><b className="num">{i.over_pct == null ? "–" : i.over_pct > 0 ? `+${num(i.over_pct, lang, 0)}%` : `${num(i.over_pct, lang, 0)}%`}</b><span>{t("dash.n_over")}</span><div className="nit-zero-bar" aria-hidden><i style={{ insetInlineStart: `${markerPos}%` }} /></div></div>
                  {isJP ? (
                    <div className="plot-metric"><TestTube2 size={18} aria-hidden /><b className="num">{i.nitrate_mg_l == null ? "–" : `${num(i.nitrate_mg_l, lang, 0)} mg/L`}</b><span>{t("dash.nitrate")}</span></div>
                  ) : (
                    <div className="plot-metric"><span className="metric-coins">●</span><b className="num">{money(i.annual_cost, region.currency, lang)}</b><span>{t("nrg.annual_cost")}</span></div>
                  )}
                </div>
                <div className="row between plot-open">
                  <Link to={`/plots/${i.plot.id}`} className="btn ghost sm">{t("dash.open")} <ArrowRight size={14} className="flip" /></Link>
                  <button className="btn danger sm" onClick={() => remove(i.plot)} aria-label={t("delete")}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {toastEl}
    </div>
  );
}
