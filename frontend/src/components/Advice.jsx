import React from "react";
import { AlertTriangle, Bot, CheckCircle2, CloudRain, Droplets, Flame, Info, Leaf, Sun, Snowflake, Sprout, TestTube2, Waves, Zap } from "lucide-react";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { dateShort, fmtN, num, pick } from "../lib/format";
import { CropGlyph } from "./art/CropGlyph";

const ICONS = {
  frost_risk: Snowflake, heat_risk: Flame, irrigate_today: Droplets, irrigate_soon: Droplets, rain_skip: CloudRain, salinity_not_suitable: Waves, salinity_risky: Waves,
  leaching_needed: Waves, over_fertilization: Sprout, nitrate_risk: AlertTriangle, apply_n_soon: Sprout, fungal_risk: Leaf, soil_test_missing: TestTube2, soil_test_old: TestTube2,
  solar_pays_back: Sun, brine_note: Zap, all_good: CheckCircle2,
};

// Convert raw engine params into display values in the user's units/language
export function useAdviceText() {
  const { t, lang } = useI18n();
  const { region } = useAuth();
  return (a, crops) => {
    if (a.text) return a.text; // phrased by the language model, grounded on the same numbers
    const p = a.params || {};
    const names = (p.alt || []).map((id) => { const c = (crops || []).find((x) => x.id === id); return c ? pick(c.name, lang) : id; }).join(", ");
    const v = {
      tmin: num(p.tmin, lang, 0), tmax: num(p.tmax, lang, 0), mm: num(p.mm, lang, 0), pct: num(p.pct, lang, 0), days: num(p.days, lang, 0), date: p.date ? dateShort(p.date, lang) : "–",
      ecw: num(p.ecw, lang, 1), yr: num(p.yr, lang, 0), lr: num((p.lr || 0) * 100, lang, 0), alt: names || "–",
      current: region ? fmtN(p.current, region, lang) : p.current, mid: region ? fmtN(p.mid, region, lang) : p.mid,
      mg: num(p.mg, lang, 0), limit: num(p.limit, lang, 0), kg: region ? fmtN(p.kg, region, lang) : p.kg, months: num(p.months, lang, 0), brine: num(p.brine, lang, 0),
    };
    if (a.code === "over_fertilization") v.pct = num(p.pct, lang, 0);
    return t(`advice.${a.code}`, v);
  };
}

export function AdviceItem({ a, crops }) {
  const { t } = useI18n();
  const text = useAdviceText();
  const Icon = ICONS[a.code] || AlertTriangle;
  const UrgencyIcon = a.urgency === "high" ? AlertTriangle : a.urgency === "medium" ? Bot : CheckCircle2;
  return (
    <div className={`advice ${a.urgency || "low"}`}>
      <div className="ico"><Icon size={20} aria-hidden /></div>
      <div className="grow">
        {a.plot_name && <div className="advice-plot"><span className="advice-crop"><CropGlyph cropId={a.crop_id} size={18} /></span><span>{a.plot_name}</span></div>}
        <div className="advice-sentence">{text(a, crops)}</div>
        <div className="tags">
          <span className={`pill ${a.urgency === "high" ? "risk" : a.urgency === "medium" ? "warn" : "info"}`}><UrgencyIcon size={14} aria-hidden />{t(`advice.urgency.${a.urgency || "low"}`)}</span>
          {a.confidence && <span className="pill neutral"><Info size={14} aria-hidden />{t(`advice.confidence.${a.confidence}`)}</span>}
          {a.text && <span className="badge-model"><Bot size={11} aria-hidden />AI</span>}
        </div>
      </div>
    </div>
  );
}

export function AdviceList({ items, crops }) {
  return <div className="stack tight">{items.map((a, i) => <AdviceItem key={`${a.code}${i}`} a={a} crops={crops} />)}</div>;
}
