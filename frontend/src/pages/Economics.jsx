import React, { useEffect, useState } from "react";
import { Calculator, FileSpreadsheet, Printer } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { money, num, pick } from "../lib/format";
import { CashFlow, Histogram, MonteCarloRegression, MonteCarloScatter, SensitivityHeatmap, Tornado } from "../components/charts";
import ProfitReport from "../components/ProfitReport";
import { AssumptionBadge, Button, Card, ErrorNote, Field, ModelBadge, Notice, Pill, RangeViz, Spinner, Stat } from "../components/ui";

export default function Economics() {
  const { region, user } = useAuth();
  const { t, lang } = useI18n();
  const cur = region.currency;
  const [plots, setPlots] = useState([]);
  const [f, setF] = useState({ crop_id: region.default_crop, plot_id: "", area_ha: "", yield_kg_ha: "", price: "", var_cost_ha: "", fixed_cost: 0, investment: 0, years: 10, discount: 8, water_cost: "", loss_reserve: 10, accident_prob: 2 });
  const [defaults, setDefaults] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [error, setError] = useState(null);

  // Plots with their computed yearly water + energy cost (from the dashboard summary).
  useEffect(() => {
    api.get("/dashboard").then((r) => setPlots(r.items.map((i) => ({ ...i.plot, water_cost: i.water_cost_season })))).catch(() => {});
  }, []);

  // Fill every field: crop figures from the server, farm figures scaled to the area, water cost from the linked plot.
  const fill = (p, d, plot) => {
    const area = plot ? Math.round(plot.area_ha * region.area_factor * 100) / 100 : p.area_ha === "" ? d.farm.area_ha * region.area_factor : Number(p.area_ha);
    const ha = area / region.area_factor;
    const water = plot && plot.water_cost != null ? plot.water_cost : d.farm.water_cost_ha * ha;
    return {
      ...p, area_ha: area, yield_kg_ha: d.defaults.yield_kg_ha, price: d.defaults.price, var_cost_ha: d.defaults.var_cost_ha,
      discount: Math.round(d.discount * 1000) / 10, years: d.farm.years,
      water_cost: Math.round(water), fixed_cost: Math.round(d.farm.fixed_cost_ha * ha), investment: Math.round(d.farm.investment_ha * ha),
    };
  };

  // load crop defaults whenever the crop changes
  useEffect(() => {
    api.get(`/economics/defaults?crop_id=${f.crop_id}`).then((r) => {
      setDefaults(r);
      setRes(null);
      setF((p) => fill(p, r, plots.find((x) => String(x.id) === String(p.plot_id))));
    }).catch(setError);
  }, [f.crop_id]);

  const body = () => ({
      crop_id: f.crop_id, plot_id: f.plot_id ? Number(f.plot_id) : undefined, area_ha: f.area_ha === "" ? undefined : Number(f.area_ha) / region.area_factor,
      yield_kg_ha: Number(f.yield_kg_ha), price: Number(f.price), var_cost_ha: Number(f.var_cost_ha), fixed_cost: Number(f.fixed_cost), investment: Number(f.investment),
      years: Number(f.years), discount: Number(f.discount) / 100, water_cost: f.water_cost === "" ? undefined : Number(f.water_cost),
      loss_reserve: Number(f.loss_reserve) / 100, accident_prob: Number(f.accident_prob) / 100,
  });
  const run = async () => {
    setBusy(true); setError(null);
    try { setRes(await api.post("/economics/simulate", body())); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const cropName = pick(region.crop_list.find((c) => c.id === f.crop_id)?.name, lang);
  const printPdf = () => {
    const old = document.title;
    document.title = `${t("bilan.title")} - ${cropName}`;
    window.print();
    document.title = old;
  };
  const downloadXlsx = async () => {
    setXlsxBusy(true); setError(null);
    try { await api.download("/economics/workbook", { ...body(), lang }, "bilan.xlsx"); } catch (e) { setError(e); } finally { setXlsxBusy(false); }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const r = res?.result;
  const mc = r?.monte_carlo;
  const drivers = Object.fromEntries(["price", "yield", "var_cost", "water_cost", "investment"].map((d) => [d, t(`eco.drivers.${d}`)]));

  return (
    <>
    <div className="stack no-print">
      <div className="page-head detail-page-head"><div><h1>{t("eco.title")}</h1><p>{t("eco.sub")}</p></div></div>

      <Card title={t("eco.inputs")} right={defaults?.defaults?.assumption && <AssumptionBadge />}>
        <div className="form-grid">
          <Field label={t("eco.crop")}><select className="input" value={f.crop_id} onChange={set("crop_id")}>{region.crop_list.map((c) => <option key={c.id} value={c.id}>{pick(c.name, lang)}</option>)}</select></Field>
          <Field label={t("eco.link_plot")} hint={t("eco.link_hint")}>
            <select className="input" value={f.plot_id} onChange={(e) => {
              const pl = plots.find((x) => String(x.id) === e.target.value);
              const next = { ...f, plot_id: e.target.value, ...(pl ? { crop_id: pl.crop_id } : {}) };
              // Same crop: refill now with the plot's area and water cost. New crop: the defaults effect refills.
              setRes(null);
              setF(pl && defaults && pl.crop_id === f.crop_id ? fill(next, defaults, pl) : next);
            }}>
              <option value="">{t("none")}</option>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={`${t("eco.area")} (${region.area_unit})`}><input className="input" type="number" step="any" value={f.area_ha} onChange={set("area_ha")} placeholder={region.id === "JP" ? "10" : "1"} /></Field>
          <Field label={t("eco.yield")}><input className="input" type="number" step="any" value={f.yield_kg_ha} onChange={set("yield_kg_ha")} /></Field>
          <Field label={`${t("eco.price")} (${cur})`}><input className="input" type="number" step="any" value={f.price} onChange={set("price")} /></Field>
          <Field label={`${t("eco.var_cost")} (${cur})`}><input className="input" type="number" step="any" value={f.var_cost_ha} onChange={set("var_cost_ha")} /></Field>
          <Field label={`${t("eco.fixed")} (${cur})`}><input className="input" type="number" step="any" value={f.fixed_cost} onChange={set("fixed_cost")} /></Field>
          <Field label={`${t("eco.invest")} (${cur})`}><input className="input" type="number" step="any" value={f.investment} onChange={set("investment")} /></Field>
          <Field label={t("eco.years")}><input className="input" type="number" min="1" max="40" value={f.years} onChange={set("years")} /></Field>
          <Field label={`${t("eco.discount")} (%)`}><input className="input" type="number" step="0.1" value={f.discount} onChange={set("discount")} /></Field>
          <Field label={`${t("eco.water_cost")} (${cur})`}><input className="input" type="number" step="any" value={f.water_cost} onChange={set("water_cost")} placeholder="0" /></Field>
          <Field label={t("eco.loss_reserve")} hint={t("eco.loss_reserve_hint")}><input className="input" type="number" min="0" max="100" step="1" value={f.loss_reserve} onChange={set("loss_reserve")} /></Field>
          <Field label={t("eco.accident_prob")} hint={t("eco.accident_prob_hint")}><input className="input" type="number" min="0" max="100" step="0.5" value={f.accident_prob} onChange={set("accident_prob")} /></Field>
        </div>
        {defaults && <p className="tiny muted" style={{ marginTop: 10 }}>{t("eco.defaults_src")}: {defaults.defaults.source}. {defaults.defaults.assumption && t("eco.is_assumption")} {t("eco.farm_defaults_note")}</p>}
        <div style={{ marginTop: 12 }}><Button busy={busy} onClick={run}><Calculator size={16} />{t("eco.run")}</Button></div>
      </Card>

      <ErrorNote error={error} />
      {busy && !res && <Spinner />}
      {!busy && !res && !error && <Notice tone="info">{t("eco.run_hint")}</Notice>}
      {r && (
        <>
          <Card title={t("bilan.export_title")} sub={t("bilan.export_sub")}>
            <div className="row wrap" style={{ gap: 10 }}>
              <Button onClick={printPdf}><Printer size={16} />{t("bilan.pdf")}</Button>
              <Button className="ghost" busy={xlsxBusy} onClick={downloadXlsx}><FileSpreadsheet size={16} />{t("bilan.excel")}</Button>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>{t("bilan.pdf_hint")}</p>
          </Card>
          {res.linked && <Notice tone="info">{t("eco.linked", { plot: res.linked.plot, f: num(res.linked.yield_factor, lang, 3) })}</Notice>}
          <div className="grid cols-4">
            <Card><Stat label={t("eco.revenue")} value={money(r.revenue, cur, lang)} note={`${t("eco.variable")}: ${money(r.variable_cost, cur, lang)}`} /></Card>
            <Card><Stat label={t("eco.margin")} value={money(r.gross_margin, cur, lang)} tone={r.gross_margin < 0 ? "risk" : undefined} note={`${t("eco.net")}: ${money(r.net_result, cur, lang)}`} /></Card>
            <Card><Stat label={t("eco.npv")} value={money(r.npv, cur, lang)} tone={r.npv < 0 ? "risk" : undefined} note={`${t("eco.payback")}: ${r.payback_year ?? t("eco.never")}`} /></Card>
            <Card><Stat label={t("eco.breakeven_p")} value={money(r.breakeven_price, cur, lang)} note={`${t("eco.breakeven_y")}: ${num(r.breakeven_yield_kg_ha, lang, 0)}`} /></Card>
          </div>

          <div className="grid cols-2">
            <Card title={t("eco.scenarios")} right={<ModelBadge />}>
              <table className="t"><thead><tr><th /><th className="n">{t("eco.revenue")}</th><th className="n">{t("eco.margin")}</th></tr></thead><tbody>
                {["low", "central", "high"].map((k) => <tr key={k}><td>{t(`eco.${k}`)}</td><td className="n">{money(r.scenarios[k].revenue, cur, lang)}</td><td className="n"><b>{money(r.scenarios[k].margin, cur, lang)}</b></td></tr>)}
              </tbody></table>
            </Card>
            <Card title={t("eco.tornado")} sub={t("eco.tornado_sub")}>
              <Tornado rows={r.tornado} base={r.tornado[0]?.base || 0} labels={drivers} currency={cur} lang={lang} />
            </Card>
          </div>

          <div className="eco-results-grid">
            <Card className="eco-mc-card" title={t("eco.mc")} sub={t("eco.mc_sub", { n: mc.runs })}>
              <div className="eco-stat-grid">
                <Stat label={t("eco.mean")} value={money(mc.mean, cur, lang)} />
                <Stat label={t("eco.std")} value={money(mc.std, cur, lang)} />
                <Stat label={t("eco.loss_margin")} value={money(mc.loss_margin, cur, lang)} tone="risk" />
                <Stat label={t("eco.accident_prob")} value={`${num(mc.accident_prob * 100, lang, 1)}%`} />
                <Stat label={t("eco.weather_factor")} value={`${num(mc.weather_yield_m * 100, lang, 0)}%`} />
                <Stat label={t("p10")} value={money(mc.p10, cur, lang)} />
                <Stat label={t("p50")} value={money(mc.p50, cur, lang)} />
                <Stat label={t("p90")} value={money(mc.p90, cur, lang)} />
              </div>
              <div className="eco-probability-row">
                <div><span className="small muted">{t("eco.prob_loss")}</span><Pill tone={mc.prob_loss > 0.2 ? "risk" : mc.prob_loss > 0.05 ? "warn" : "ok"}>{num(mc.prob_loss * 100, lang, 0)}%</Pill></div>
                <div><span className="small muted">{t("eco.prob_profit")}</span><Pill tone="ok">{num(mc.prob_profit * 100, lang, 0)}%</Pill></div>
              </div>
              <div className="eco-mc-range">
                <span><b>{t("eco.range")}</b> {money(mc.p10, cur, lang)} — {money(mc.p90, cur, lang)}</span>
                <span>{t("eco.expected")}: <b>{money(mc.mean, cur, lang)}</b></span>
              </div>
              <div className="eco-chart-tabs">
                <div><div className="small muted eco-chart-title">{t("eco.hist")}</div><Histogram hist={mc.hist} currency={cur} lang={lang} labels={{ x: t("eco.axis_margin"), y: t("eco.axis_runs") }} /></div>
                <div><div className="small muted eco-chart-title">{t("eco.simulations")}</div><MonteCarloScatter samples={mc.samples} currency={cur} lang={lang} labels={{ x: t("eco.axis_run"), y: t("eco.axis_margin") }} /></div>
              </div>
              <div className="eco-regression-block">
                <div className="eco-chart-title"><b>{t("eco.regression")}</b><div className="tiny muted">{t("eco.regression_sub")}</div></div>
                <MonteCarloRegression
                  samples={mc.samples}
                  currency={cur}
                  lang={lang}
                  labels={{ y: t("eco.axis_margin"), select: t("eco.choose_axis"), trend: t("eco.trend") }}
                  selectedLabels={{ yield: t("eco.driver_yield"), price: t("eco.driver_price"), var: t("eco.driver_var"), water: t("eco.driver_water") }}
                />
              </div>
              <div className="eco-heatmap-block"><div className="small muted eco-chart-title">{t("eco.heatmap")}</div><SensitivityHeatmap cells={mc.heatmap} currency={cur} lang={lang} labels={{ yield: t("eco.driver_yield"), price: t("eco.driver_price") }} /></div>
            </Card>
            <Card title={t("eco.flows")}><CashFlow flows={r.flows} currency={cur} lang={lang} labelYear={t("eco.year")} /></Card>
          </div>
        </>
      )}
    </div>
    {r && <ProfitReport res={res} region={region} user={user} cropName={cropName} />}
    </>
  );
}
