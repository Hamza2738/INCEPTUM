import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { areaIn, areaOut, nIn, nOut, pick } from "../lib/format";
import { Button, Field, Notice } from "./ui";
import MapPicker from "./MapPicker";

const IRR = ["drip", "sprinkler", "pivot", "surface", "paddy"];
const r2 = (v, d = 2) => (v == null ? "" : Math.round(v * 10 ** d) / 10 ** d);

// Values are displayed in the region's units (ha or 10 a, kg/ha or kg/10 a) and converted back on save.
export default function PlotForm({ plot, onSaved, onCancel }) {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const isNew = !plot;
  const [f, setF] = useState(() => ({
    name: plot?.name || "",
    crop_id: plot?.crop_id || region.default_crop,
    area: plot ? r2(areaOut(plot.area_ha, region), 2) : region.id === "JP" ? 10 : 1,
    soil_texture: plot?.soil_texture || region.soil_list[Math.min(3, region.soil_list.length - 1)].id,
    sowing_date: plot?.sowing_date || "",
    irrigation_type: plot?.irrigation_type || (region.id === "JP" ? "sprinkler" : "drip"),
    well_depth_m: plot?.well_depth_m ?? (region.id === "JP" ? 20 : 80),
    pump_eff: plot?.pump_eff ?? 0.55,
    water_ec: plot?.water_ec ?? (region.id === "JP" ? 0.4 : 2.5),
    fert_n: plot ? r2(nOut(plot.fert_n_current, region), 1) : region.id === "JP" ? 30 : 100,
    greenhouse: plot?.greenhouse || false,
    lat: plot?.lat ?? "",
    lon: plot?.lon ?? "",
  }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  useEffect(() => {
    if (!isNew || f.lat === "" || f.lon === "") return;
    const timer = window.setTimeout(async () => {
      try {
        const r = await api_post_location(Number(f.lat), Number(f.lon));
        const s = r.suggestions;
        setLocationInfo(s);
        setF((p) => ({
          ...p,
          soil_texture: s.soil_texture || p.soil_texture,
          water_ec: s.water_ec ?? p.water_ec,
          irrigation_type: s.irrigation_type || p.irrigation_type,
          well_depth_m: s.well_depth_m ?? p.well_depth_m,
          pump_eff: s.pump_eff ?? p.pump_eff,
          fert_n: s.fert_n ?? p.fert_n,
        }));
      } catch (_) {
        setLocationInfo(null);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [f.lat, f.lon, isNew]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.lat === "" || f.lon === "") { setErr(t("plots.location_hint")); return; }
    setBusy(true);
    const body = {
      name: f.name, crop_id: f.crop_id, area_ha: areaIn(Number(f.area), region), soil_texture: f.soil_texture, sowing_date: f.sowing_date || null,
      irrigation_type: f.irrigation_type, well_depth_m: Number(f.well_depth_m), pump_eff: Number(f.pump_eff), water_ec: Number(f.water_ec),
      fert_n_current: nIn(Number(f.fert_n), region), greenhouse: f.greenhouse, lat: Number(f.lat), lon: Number(f.lon),
    };
    try {
      const res = isNew ? await api_post(body) : await api_put(plot.id, body);
      onSaved(res.plot, isNew);
    } catch (ex) {
      setErr(ex.data?.fields?.includes("outside_region") ? t("plots.outside") : ex.code === "network" ? t("error_network") : t("error_generic"));
    } finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-grid">
        <Field label={t("plots.name")}><input className="input" value={f.name} onChange={set("name")} required maxLength={150} /></Field>
        <Field label={t("plots.crop")}>
          <select className="input" value={f.crop_id} onChange={set("crop_id")}>{region.crop_list.map((c) => <option key={c.id} value={c.id}>{pick(c.name, lang)}</option>)}</select>
        </Field>
        <Field label={`${t("plots.area")} (${region.area_unit})`}><input className="input" type="number" step="any" min="0.01" value={f.area} onChange={set("area")} required /></Field>
        <Field label={t("plots.soil")}>
          <select className="input" value={f.soil_texture} onChange={set("soil_texture")}>{region.soil_list.map((s) => <option key={s.id} value={s.id}>{pick(s.name, lang)}</option>)}</select>
        </Field>
        <Field label={t("plots.irrigation")}>
          <select className="input" value={f.irrigation_type} onChange={set("irrigation_type")}>{IRR.map((k) => <option key={k} value={k}>{t(`plots.types.${k}`)}</option>)}</select>
        </Field>
        <Field label={`${t("plots.well")} (${t("plots.well_unit")})`}><input className="input" type="number" step="any" min="0" max="1500" value={f.well_depth_m} onChange={set("well_depth_m")} /></Field>
        <Field label={`${t("plots.eff")} (0.2 – 0.95)`}><input className="input" type="number" step="0.01" min="0.2" max="0.95" value={f.pump_eff} onChange={set("pump_eff")} /></Field>
        <Field label={`${t("plots.water_ec")} (dS/m)`} hint={t("plots.water_ec_hint")}><input className="input" type="number" step="0.1" min="0" max="40" value={f.water_ec} onChange={set("water_ec")} required /></Field>
        <Field label={`${t("plots.fert")} (${region.n_unit})`} hint={t("plots.fert_hint", { unit: region.n_unit })}><input className="input" type="number" step="any" min="0" value={f.fert_n} onChange={set("fert_n")} required /></Field>
        <Field label={t("plots.sowing")} hint={t("plots.sowing_hint")}><input className="input" type="date" value={f.sowing_date} onChange={set("sowing_date")} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.greenhouse} onChange={set("greenhouse")} />{t("plots.greenhouse")}</label>

      <div>
        <div className="field"><label>{t("plots.location")}</label><span className="hint">{t("plots.location_hint")}</span></div>
        <MapPicker lat={f.lat} lon={f.lon} center={region.map.center} zoom={region.map.zoom} onPick={(la, lo) => setF((p) => ({ ...p, lat: r2(la, 4), lon: r2(lo, 4) }))} />
        {locationInfo && <Notice tone="ok" style={{ marginTop: 10 }}>{`${t("plots.location_auto")}${locationInfo.reference_name ? ` — ${locationInfo.reference_name}` : ""}${locationInfo.source === "regional_reference" ? "" : ""}`}</Notice>}
        <div className="form-grid" style={{ marginTop: 10 }}>
          <Field label={t("plots.lat")}><input className="input" type="number" step="any" value={f.lat} onChange={set("lat")} required /></Field>
          <Field label={t("plots.lon")}><input className="input" type="number" step="any" value={f.lon} onChange={set("lon")} required /></Field>
        </div>
      </div>

      {err && <Notice tone="risk">{err}</Notice>}
      <div className="row"><Button type="submit" busy={busy}>{t("save")}</Button><Button type="button" className="ghost" onClick={onCancel}>{t("cancel")}</Button></div>
    </form>
  );
}

import { api } from "../api";
const api_post = (b) => api.post("/plots", b);
const api_put = (id, b) => api.put(`/plots/${id}`, b);
const api_post_location = (lat, lon) => api.post("/plots/location-suggestions", { lat, lon });
