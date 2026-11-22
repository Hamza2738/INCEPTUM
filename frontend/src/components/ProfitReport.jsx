import React from "react";
import { useI18n } from "../i18n";
import { dateLong, money, num } from "../lib/format";

// Plain-language profitability report, shown only when printing (browser "Save as PDF").
// Written for farmers who are not used to financial terms: three big numbers, short sentences, one table.
export default function ProfitReport({ res, region, user, cropName }) {
  const { t, lang } = useI18n();
  const r = res.result;
  const inp = res.inputs;
  const mc = r.monte_carlo;
  const cur = res.currency || region.currency;
  const m = (v) => money(v, cur, lang);
  const dep = inp.investment / Math.max(1, inp.years);
  const out = r.revenue - r.net_result;
  const kg = inp.yield_kg_ha * inp.area_ha * inp.yield_factor;
  const verdict = r.net_result < 0 ? "ko" : mc.prob_loss > 0.2 ? "risky" : "ok";
  const area = `${num(inp.area_ha * region.area_factor, lang, 2)} ${region.area_unit}`;
  const minYield = r.breakeven_yield_kg_ha == null ? null : r.breakeven_yield_kg_ha / region.area_factor;
  const top = (r.tornado || [])[0]?.driver;

  let cum = -inp.investment;
  const years = r.flows.map((f, i) => { cum += f; return { y: i + 1, f, cum }; });

  const tips = [];
  if (r.net_result < 0) tips.push("tip_loss");
  if (mc.prob_loss > 0.2) tips.push("tip_risk");
  if (top === "price") tips.push("tip_price");
  else if (top === "yield") tips.push("tip_yield");
  else if (top === "water_cost") tips.push("tip_water");
  else if (top) tips.push("tip_cost");
  tips.push("tip_book");

  return (
    <div className="print-only profit-report">
      <div className="pr-head">
        <div className="tiny muted">{t("app_name")} · {t("bilan.title")}</div>
        <h1>{t("bilan.title")}</h1>
        <p>{t("bilan.for", { crop: cropName, area, date: dateLong(new Date().toISOString().slice(0, 10), lang), who: user?.name || "" })}</p>
        {res.linked && <p className="muted">{t("bilan.plot", { plot: res.linked.plot })}</p>}
      </div>

      <div className={`pr-verdict pr-${verdict}`}>
        <b>{t(`bilan.verdict_${verdict}`)}</b>
        <div>{r.net_result < 0 ? t("bilan.verdict_ko_d", { v: m(-r.net_result) }) : t("bilan.verdict_ok_d", { v: m(r.net_result) })}</div>
      </div>

      <div className="pr-big">
        <div><span>{t("bilan.in")}</span><b>{m(r.revenue)}</b><small>{t("bilan.in_d", { kg: num(kg, lang, 0), p: m(inp.price) })}</small></div>
        <div><span>{t("bilan.out")}</span><b>{m(out)}</b><small>{t("bilan.out_d")}</small></div>
        <div className={r.net_result < 0 ? "neg" : "pos"}><span>{t("bilan.left")}</span><b>{m(r.net_result)}</b><small>{t("bilan.left_d")}</small></div>
      </div>

      <h2>{t("bilan.key")}</h2>
      <ul className="pr-list">
        <li>{t("bilan.k_range", { lo: m(mc.p10 - dep), hi: m(mc.p90 - dep) })}</li>
        <li>{t("bilan.k_loss", { pct: num(mc.prob_loss * 100, lang, 0) })}</li>
        {r.breakeven_price != null && <li>{t("bilan.k_price", { p: m(r.breakeven_price) })}</li>}
        {minYield != null && <li>{t("bilan.k_yield", { y: num(minYield, lang, 0), unit: region.area_unit })}</li>}
        {inp.investment > 0 && <li>{r.payback_year ? t("bilan.k_payback", { inv: m(inp.investment), y: r.payback_year }) : t("bilan.k_payback_never", { inv: m(inp.investment), n: inp.years })}</li>}
        {top && <li>{t("bilan.k_driver", { d: t(`eco.drivers.${top}`) })}</li>}
      </ul>

      <h2>{t("bilan.scen")}</h2>
      <table className="t pr-table">
        <tbody>
          {[["low", "s_bad", "s_bad_d"], ["central", "s_normal", null], ["high", "s_good", "s_good_d"]].map(([k, label, d]) => {
            const v = r.scenarios[k].margin - dep;
            return <tr key={k}><td><b>{t(`bilan.${label}`)}</b>{d && <span className="muted"> ({t(`bilan.${d}`)})</span>}</td><td className={`n ${v < 0 ? "neg" : ""}`}><b>{m(v)}</b></td></tr>;
          })}
        </tbody>
      </table>

      <h2>{t("bilan.years")}</h2>
      <table className="t pr-table">
        <thead><tr><th>{t("bilan.y_year")}</th><th className="n">{t("bilan.y_flow")}</th><th className="n">{t("bilan.y_cum")}</th></tr></thead>
        <tbody>
          {inp.investment > 0 && <tr><td>{t("bilan.y_start")}</td><td className="n neg">{m(-inp.investment)}</td><td className="n neg">{m(-inp.investment)}</td></tr>}
          {years.map((row) => <tr key={row.y}><td>{row.y}</td><td className={`n ${row.f < 0 ? "neg" : ""}`}>{m(row.f)}</td><td className={`n ${row.cum < 0 ? "neg" : ""}`}>{m(row.cum)}</td></tr>)}
        </tbody>
      </table>

      <h2>{t("bilan.tips")}</h2>
      <ul className="pr-list">{tips.map((k) => <li key={k}>{t(`bilan.${k}`)}</li>)}</ul>

      <p className="pr-note">{t("bilan.note")}</p>
    </div>
  );
}
