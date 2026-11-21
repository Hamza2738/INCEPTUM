import React from "react";
import { useAuth } from "../../auth";
import { useI18n } from "../../i18n";
import { num, pick, VERDICT_TONE } from "../../lib/format";
import { AssumptionBadge, Card, KV, ModelBadge, Notice, Pill, RangeViz, Stat } from "../../components/ui";

export default function SalinitySection({ a }) {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const s = a.salinity;
  const f = a.fertilizer;
  const e = a.energy;
  const crop = region.crop_list;

  return (
    <div className="stack">
      <Card title={t("sal.title")} sub={t("sal.sub")} right={<ModelBadge />}>
        <div className="row wrap" style={{ marginBottom: 14 }}>
          <Pill tone={VERDICT_TONE[s.verdict] || "neutral"}>{t(`sal.verdict.${s.verdict}`)}</Pill>
          <span className="muted small">{pick(a.crop.name, lang)} · ECe {t("sal.thr").toLowerCase()} {num(s.threshold_ece, lang, 1)} dS/m</span>
        </div>
        <div className="grid cols-4">
          <Stat label={t("sal.ecw")} value={num(s.ecw, lang, 1)} unit="dS/m" />
          <Stat label={t("sal.ece")} value={num(s.ece_est, lang, 1)} unit="dS/m" note={s.ece_measured != null ? `${t("sal.ece_measured")}: ${num(s.ece_measured, lang, 1)}` : undefined} />
          <Stat label={t("sal.yield")} value={num(s.yield_rel, lang, 0)} unit="%" tone={s.yield_rel < 85 ? "risk" : s.yield_rel < 95 ? "warn" : "ok"} />
          <Stat label={t("sal.lr")} value={s.lr != null ? num(s.lr * 100, lang, 0) : "–"} unit="%" note={s.extra_water_factor ? `${t("sal.extra")}: +${num((s.extra_water_factor - 1) * 100, lang, 0)}%` : undefined} />
        </div>
        <div style={{ marginTop: 18 }}>
          <RangeViz low={0} high={s.threshold_ece} mark={s.ece_est} max={Math.max(s.threshold_ece * 2, s.ece_est * 1.2)} bandLabel={`${t("sal.thr")}: 0 – ${num(s.threshold_ece, lang, 1)} dS/m`} markLabel={`${t("sal.ece")}: ${num(s.ece_est, lang, 1)} dS/m`} />
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>{t("sal.scale_note")}</p>
        {s.lr_feasible === false && <Notice tone="risk">{t("sal.infeasible")}</Notice>}
      </Card>

      <div className="grid cols-2">
        <Card title={t("sal.blend")} right={<AssumptionBadge />}>
          {f.blend_fraction > 0 ? (
            <>
              <p>{t("sal.blend_d", { pct: num(f.blend_fraction * 100, lang, 0), target: num(f.ecw_effective, lang, 1) })}</p>
              <KV rows={[[t("nrg.treated"), `${num(e.treated_fraction * 100, lang, 0)}%`], [t("nrg.treat"), `${num(e.treat_kwh_m3, lang, 2)} kWh/m³`], [t("nrg.leach_extra"), `+${num(e.leaching_extra_pct, lang, 0)}%`]]} />
              {e.brine_m3 > 0 && <Notice tone="warn"><div><b>{t("sal.brine")}:</b> {num(e.brine_m3, lang, 0)} m³/{t("per_year")}. {t("sal.brine_d")}</div></Notice>}
            </>
          ) : <p className="muted">{t("sal.no_blend")}</p>}
        </Card>

        <Card title={t("sal.alts")}>
          {s.alternatives?.length ? (
            <table className="t"><thead><tr><th>{t("plots.crop")}</th><th className="n">{t("sal.alt_yield")}</th></tr></thead><tbody>
              {s.alternatives.map((x) => {
                const c = crop.find((k) => k.id === x.crop_id);
                return <tr key={x.crop_id}><td>{c ? pick(c.name, lang) : x.crop_id}</td><td className="n">{num(x.yield_rel, lang, 0)}%</td></tr>;
              })}
            </tbody></table>
          ) : <p className="muted">–</p>}
        </Card>
      </div>
    </div>
  );
}
