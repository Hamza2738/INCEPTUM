import React from "react";
import { CloudRain, Droplets, Flame, Snowflake, Thermometer } from "lucide-react";
import { useI18n } from "../../i18n";
import { dateLong, num } from "../../lib/format";
import { WaterChart } from "../../components/charts";
import { Card, ModelBadge, Notice, Pill, Stat } from "../../components/ui";

const LEVEL_TONE = { low: "ok", medium: "warn", high: "risk" };

export default function WaterSection({ a }) {
  const { t, lang } = useI18n();
  const w = a.water.summary;
  const r = a.risks;
  const src = a.weather?.source || "";
  const srcLabel = src.startsWith("synthetic") ? t("water.src_synthetic") : a.weather?.stale ? t("water.src_stale") : src.includes("cache") ? t("water.src_cache") : t("water.src_live");
  const paddy = (a.warnings || []).some((x) => x.code === "paddy_not_modeled");

  return (
    <div className="stack">
      {paddy && <Notice tone="warn">{t("water.paddy_note")}</Notice>}
      <div className="grid cols-4">
        <Card><Stat label={t("water.depletion")} value={num(w.depletion_mm, lang, 0)} unit="mm" note={`${num(w.depletion_pct_raw, lang, 0)}% / RAW`} /></Card>
        <Card><Stat label={t("water.need")} value={num(w.today_need_mm, lang, 1)} unit="mm" note={`${t("water.etc")}: ${num(w.today_etc_mm, lang, 1)} mm`} /></Card>
        <Card><Stat label={t("water.next")} value={w.next_irrigation_date ? dateLong(w.next_irrigation_date, lang) : t("water.none_soon")} note={w.next_irrigation_gross_mm ? `≈ ${num(w.next_irrigation_gross_mm, lang, 0)} mm` : undefined} /></Card>
        <Card><Stat label={t("water.rain3")} value={num(w.rain_next3_mm, lang, 1)} unit="mm" note={`Ks ${num(w.ks_today, lang, 2)}`} /></Card>
      </div>

      <Card title={t("water.title")} sub={t("water.sub")} right={<ModelBadge />}>
        <WaterChart series={a.water.series} raw={a.water.raw} />
        <div className="row wrap tiny muted" style={{ marginTop: 8, gap: 18 }}>
          <span>TAW {num(a.water.taw, lang, 0)} mm</span><span>RAW {num(a.water.raw, lang, 0)} mm</span><span>{t("water.rel")}: {num((w.rel_yield_water || 1) * 100, lang, 0)}%</span>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t("water.risks")}>
          <div className="stack tight">
            <div className="row between"><span className="row"><Snowflake size={16} aria-hidden />{t("water.frost")} ({t("water.tmin")} {num(r.tmin, lang, 0)}°C)</span><Pill tone={r.frost ? "risk" : "ok"}>{r.frost ? t("water.level_high") : t("water.no")}</Pill></div>
            <div className="row between"><span className="row"><Flame size={16} aria-hidden />{t("water.heat")} ({t("water.tmax")} {num(r.tmax, lang, 0)}°C)</span><Pill tone={r.heat ? "risk" : "ok"}>{r.heat ? t("water.level_high") : t("water.no")}</Pill></div>
            <div className="row between"><span className="row"><CloudRain size={16} aria-hidden />{t("water.fungal")}</span><Pill tone={LEVEL_TONE[r.fungal_level] || "neutral"}>{t(`water.level_${r.fungal_level}`)}</Pill></div>
          </div>
        </Card>
        <Card title={t("water.weather_source")}>
          <div className="row"><Thermometer size={18} aria-hidden /><Pill tone={src.startsWith("synthetic") ? "warn" : "ok"}>{srcLabel}</Pill></div>
          {a.weather?.fetched_at && <div className="tiny muted" style={{ marginTop: 8 }}>{a.weather.fetched_at}</div>}
        </Card>
      </div>
    </div>
  );
}
