import React, { useState } from "react";
import { Play } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useI18n } from "../../i18n";
import { fmtN, num } from "../../lib/format";
import { CompareLines } from "../../components/charts";
import { Button, Card, ErrorNote, Field, ModelBadge } from "../../components/ui";

export default function WhatIfSection({ plot }) {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const [p, setP] = useState({ delay_days: 0, rain_factor: 1, dose_factor: 1, n_factor: 1 });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null);
    try { setRes(await api.post(`/plots/${plot.id}/whatif`, p)); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const slider = (k, min, max, step, fmt) => (
    <Field label={`${t(`wi.${{ delay_days: "delay", rain_factor: "rain", dose_factor: "dose", n_factor: "nfactor" }[k]}`)}: ${fmt(p[k])}`}>
      <input type="range" min={min} max={max} step={step} value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />
    </Field>
  );
  const rows = res && [
    [t("wi.yield"), `${num(res.base.yield_factor * 100, lang, 1)}%`, `${num(res.scenario.yield_factor * 100, lang, 1)}%`],
    [t("wi.etc_ratio"), num(res.base.water.eta_etc_ratio, lang, 2), num(res.scenario.water.eta_etc_ratio, lang, 2)],
    [t("wi.applied"), fmtN(res.base.n.n_applied, region, lang), fmtN(res.scenario.n.n_applied, region, lang)],
    [t("wi.leached"), fmtN(res.base.n.n_leached, region, lang), fmtN(res.scenario.n.n_leached, region, lang)],
    [t("wi.ece"), `${num(res.base.n.ece_max, lang, 1)} dS/m`, `${num(res.scenario.n.ece_max, lang, 1)} dS/m`],
  ];

  return (
    <div className="stack">
      <Card title={t("wi.title")} sub={t("wi.sub")} right={<ModelBadge />}>
        <div className="form-grid">
          {slider("delay_days", 0, 5, 1, (v) => `${v}`)}
          {slider("rain_factor", 0, 1.5, 0.1, (v) => `${Math.round(v * 100)}%`)}
          {slider("dose_factor", 0.5, 1.2, 0.05, (v) => `${Math.round(v * 100)}%`)}
          {slider("n_factor", 0.5, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`)}
        </div>
        <div className="row" style={{ marginTop: 14 }}><Button busy={busy} onClick={run}><Play size={16} />{t("wi.run")}</Button><Button className="ghost" onClick={() => { setP({ delay_days: 0, rain_factor: 1, dose_factor: 1, n_factor: 1 }); setRes(null); }}>{t("reset")}</Button><span className="tiny muted">{t("wi.hint")}</span></div>
      </Card>
      <ErrorNote error={error} />
      {res && (
        <div className="grid cols-2">
          <Card title={t("water.chart_dr")}>
            <CompareLines cur={res.base.series} rec={res.scenario.series} keyName="dr" unit="mm" labelCur={t("wi.base")} labelRec={t("wi.scenario")} />
          </Card>
          <Card>
            <table className="t"><thead><tr><th /><th className="n">{t("wi.base")}</th><th className="n">{t("wi.scenario")}</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="n">{r[1]}</td><td className="n"><b>{r[2]}</b></td></tr>)}</tbody></table>
          </Card>
        </div>
      )}
    </div>
  );
}
