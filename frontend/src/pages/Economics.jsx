import React, { useEffect, useRef, useState } from "react";
import { Calculator } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { money, num, pick } from "../lib/format";
import { CashFlow, Histogram, Tornado } from "../components/charts";
import { AssumptionBadge, Button, Card, ErrorNote, Field, ModelBadge, Notice, Pill, RangeViz, Spinner, Stat } from "../components/ui";

export default function Economics() {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const cur = region.currency;
  const [plots, setPlots] = useState([]);
  const [f, setF] = useState({ crop_id: region.default_crop, plot_id: "", area_ha: "", yield_kg_ha: "", price: "", var_cost_ha: "", fixed_cost: 0, investment: 0, years: 10, discount: 8, water_cost: "" });
  const [defaults, setDefaults] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const first = useRef(true);

  useEffect(() => { api.get("/plots").then((r) => setPlots(r.plots)).catch(() => {}); }, []);

  // load crop defaults whenever the crop changes
  useEffect(() => {
    api.get(`/economics/defaults?crop_id=${f.crop_id}`).then((r) => {
      setDefaults(r);
      setF((p) => ({ ...p, yield_kg_ha: r.defaults.yield_kg_ha, price: r.defaults.price, var_cost_ha: r.defaults.var_cost_ha, discount: Math.round(r.discount * 1000) / 10 }));
    }).catch(setError);
  }, [f.crop_id]);

  const run = async () => {
    setBusy(true); setError(null);
    const body = {
      crop_id: f.crop_id, plot_id: f.plot_id ? Number(f.plot_id) : undefined, area_ha: f.area_ha === "" ? undefined : Number(f.area_ha) / region.area_factor,
      yield_kg_ha: Number(f.yield_kg_ha), price: Number(f.price), var_cost_ha: Number(f.var_cost_ha), fixed_cost: Number(f.fixed_cost), investment: Number(f.investment),
      years: Number(f.years), discount: Number(f.discount) / 100, water_cost: f.water_cost === "" ? undefined : Number(f.water_cost),
    };
    try { setRes(await api.post("/economics/simulate", body)); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  useEffect(() => { if (defaults && first.current) { first.current = false; run(); } }, [defaults]); // eslint-disable-line

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const r = res?.result;
  const mc = r?.monte_carlo;
  const drivers = Object.fromEntries(["price", "yield", "var_cost", "water_cost", "investment"].map((d) => [d, t(`eco.drivers.${d}`)]));

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("eco.title")}</h1><p>{t("eco.sub")}</p></div></div>

      <Card title={t("eco.inputs")} right={defaults?.defaults?.assumption && <AssumptionBadge />}>
        <div className="form-grid">
          <Field label={t("eco.crop")}><select className="input" value={f.crop_id} onChange={set("crop_id")}>{region.crop_list.map((c) => <option key={c.id} value={c.id}>{pick(c.name, lang)}</option>)}</select></Field>
          <Field label={t("eco.link_plot")} hint={t("eco.link_hint")}>
            <select className="input" value={f.plot_id} onChange={(e) => { const pl = plots.find((x) => String(x.id) === e.target.value); setF({ ...f, plot_id: e.target.value, ...(pl ? { crop_id: pl.crop_id, area_ha: Math.round(pl.area_ha * region.area_factor * 100) / 100 } : {}) }); }}>
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
          <Field label={`${t("eco.water_cost")} (${cur})`}><input className="input" type="number" step="any" value={f.water_cost} onChange={set("water_cost")} placeholder={f.plot_id ? "auto" : "0"} /></Field>
        </div>
        {defaults && <p className="tiny muted" style={{ marginTop: 10 }}>{t("eco.defaults_src")}: {defaults.defaults.source}. {defaults.defaults.assumption && t("eco.is_assumption")}</p>}
        <div style={{ marginTop: 12 }}><Button busy={busy} onClick={run}><Calculator size={16} />{t("eco.run")}</Button></div>
      </Card>

      <ErrorNote error={error} />
      {busy && !res && <Spinner />}
      {r && (
        <>
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

          <div className="grid cols-2">
            <Card title={t("eco.mc")} sub={t("eco.mc_sub", { n: mc.runs })}>
              <div className="grid cols-3" style={{ marginBottom: 10 }}>
                <Stat label={t("p10")} value={money(mc.p10, cur, lang)} />
                <Stat label={t("p50")} value={money(mc.p50, cur, lang)} />
                <Stat label={t("p90")} value={money(mc.p90, cur, lang)} />
              </div>
              <div className="row" style={{ marginBottom: 8 }}><span className="small muted">{t("eco.prob_loss")}</span><Pill tone={mc.prob_loss > 0.2 ? "risk" : mc.prob_loss > 0.05 ? "warn" : "ok"}>{num(mc.prob_loss * 100, lang, 0)}%</Pill></div>
              <div className="small muted">{t("eco.hist")}</div>
              <Histogram hist={mc.hist} currency={cur} lang={lang} />
            </Card>
            <Card title={t("eco.flows")}><CashFlow flows={r.flows} currency={cur} lang={lang} labelYear={t("eco.year")} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
