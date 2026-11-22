import React from "react";
import { useI18n } from "../../i18n";
import { money, num } from "../../lib/format";
import { AssumptionBadge, Card, KV, ModelBadge, Notice, Pill, RangeViz, Stat } from "../../components/ui";

export default function EnergySection({ a }) {
  const { t, lang } = useI18n();
  const e = a.energy;
  const cur = e.currency;
  const b = e.bands;
  const pb = b.payback_months;
  const zero = !e.annual_cost;
  const ghiAssumed = (e.ghi?.source || "").includes("ASSUMPTION") || (e.ghi?.source || "").includes("fallback");

  return (
    <div className="stack">
      <Card title={t("nrg.title")} sub={t("nrg.sub")} right={<ModelBadge />}>
        {zero && <Notice tone="info">{t("nrg.zero")}</Notice>}
        <div className="grid cols-4" style={{ marginTop: zero ? 12 : 0 }}>
          <Stat label={t("nrg.pump")} value={num(e.pump_co2_kg_m3, lang, 2)} unit={t("nrg.unit")} />
          <Stat label={t("nrg.treat")} value={num(e.treat_co2_kg_m3, lang, 2)} unit={t("nrg.unit")} note={`${t("nrg.treated")}: ${num((e.treated_fraction || 0) * 100, lang, 0)}%`} />
          <Stat label={t("nrg.total")} value={num(e.total_co2_kg_m3, lang, 2)} unit={t("nrg.unit")} />
          <Stat label={t("nrg.annual_m3")} value={num(e.annual_m3, lang, 0)} unit="m³" />
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t("nrg.annual_cost")} right={<AssumptionBadge />}>
          <div className="grid cols-2">
            <Stat label={t("nrg.annual_cost")} value={money(e.annual_cost, cur, lang)} note={`P10: ${money(b.annual_cost.p10, cur, lang)} · P90: ${money(b.annual_cost.p90, cur, lang)}`} />
            <Stat label={t("nrg.annual_kwh")} value={num(e.annual_co2_t, lang, 1)} unit={t("nrg.co2_unit")} note={b.annual_co2_t ? `P10: ${num(b.annual_co2_t.p10, lang, 1)} · P90: ${num(b.annual_co2_t.p90, lang, 1)}` : null} />
          </div>
          <div className="tiny muted" style={{ marginTop: 10 }}>{t("nrg.factor_note", { f: num(e.co2_kg_per_kwh, lang, 2) })} <AssumptionBadge /></div>
          <div className="tiny muted" style={{ marginTop: 4 }}>{t("nrg.tariff_note")}: {e.tariff_note}</div>
        </Card>

        <Card title={`${t("nrg.pv")}: ${num(e.pv_kw, lang, 1)} ${t("nrg.pv_kw")}`} right={<AssumptionBadge />}>
          <div className="grid cols-2">
            <Stat label={t("nrg.capex")} value={money(e.capex, cur, lang)} note={t("nrg.capex_note")} />
            <Stat label={t("nrg.savings")} value={money(e.pv_savings, cur, lang)} note={`${t("nrg.share")}: ${num((e.pv_share || 0) * 100, lang, 0)}%`} />
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>{t("nrg.payback")}</div>
            {e.payback_months_p50 == null || !pb.p50 ? <Pill tone="neutral">{t("nrg.never")}</Pill> : (
              <>
                <div className="stat"><div className="value">{num(pb.p50, lang, 0)}<small>{t("nrg.months")}</small></div></div>
                {pb.p10 != null && pb.p90 != null && <RangeViz low={pb.p10} high={pb.p90} mark={pb.p50} max={pb.p90} bandLabel={`${t("nrg.range")}: ${num(pb.p10, lang, 0)} – ${num(pb.p90, lang, 0)} ${t("nrg.months")}`} markLabel={`${t("p50")}: ${num(pb.p50, lang, 0)}`} />}
              </>
            )}
          </div>
          <div className="row wrap tiny muted" style={{ gap: 16, marginTop: 8 }}>
            <span>{t("nrg.co2")}: {num(e.pv_co2_avoided_t, lang, 1)} {t("nrg.co2_unit")}</span>
            <span>{t("nrg.ghi")}: {num(e.ghi?.kwh_m2_year, lang, 0)} kWh/m²/y {ghiAssumed && <AssumptionBadge />}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
