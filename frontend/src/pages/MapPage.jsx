import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { dateLong, num, pick } from "../lib/format";
import { Button, Card, ErrorNote, Field, Notice, Spinner, useToast } from "../components/ui";

const OK = "#0ca30c", WARN = "#fab219", RISK = "#d03b3b";
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const BLUE = [[205, 226, 251], [24, 79, 149]];
const AMBER = [[253, 232, 176], [201, 133, 0]];
const seq = (scale, t) => hex(lerp(scale[0], scale[1], t));
const BLUE_CSS = "linear-gradient(90deg,#cde2fb,#184f95)";
const AMBER_CSS = "linear-gradient(90deg,#fde8b0,#c98500)";
const STATUS_CSS = `linear-gradient(90deg,${OK},${WARN},${RISK})`;

function layerValue(layer, i, limit) {
  switch (layer) {
    case "stress": { const v = i.ks_today ?? 1; return { v, color: v >= 0.95 ? OK : v >= 0.8 ? WARN : RISK }; }
    case "moisture": { const v = i.depletion_pct_raw ?? 0; return { v, color: seq(BLUE, v / 100) }; }
    case "salinity": { const v = i.yield_rel ?? 100; return { v, color: v >= 95 ? OK : v >= 85 ? WARN : RISK }; }
    case "leaching": { const v = (i.lr ?? 0) * 100; return { v, color: seq(BLUE, v / 40) }; }
    case "solar": { const v = i.ghi ?? 0; return { v, color: seq(AMBER, (v - 1200) / 900) }; }
    case "nitrate": { const v = i.nitrate_mg_l; return { v, color: v == null ? "#898781" : v <= (limit || 10) ? OK : v <= (limit || 10) * 2 ? WARN : RISK }; }
    default: return { v: null, color: "#898781" };
  }
}
const LEGEND = { stress: STATUS_CSS, moisture: BLUE_CSS, salinity: STATUS_CSS, leaching: BLUE_CSS, solar: AMBER_CSS, nitrate: STATUS_CSS };
const MEAS_COLOR = { ec: "#eb6834", moisture: "#2a78d6", ph: "#1baf7a" };

function Fit({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 9 }); else if (points.length === 1) map.setView(points[0], 8); }, [points.length]); // eslint-disable-line
  return null;
}
function Clicker({ active, onPick }) {
  useMapEvents({ click: (e) => active && onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapPage() {
  const { region } = useAuth();
  const { t, lang } = useI18n();
  const limit = region.standards?.nitrate_limit_mg_l_n;
  const layers = region.id === "JP" ? ["nitrate", "salinity", "stress", "moisture", "solar"] : ["salinity", "leaching", "stress", "moisture", "solar"];
  const [layer, setLayer] = useState(layers[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(null);
  const [form, setForm] = useState({ kind: "ec", value: "", note: "" });
  const [, toast, toastEl] = useToast();

  const load = () => api.get("/map/overview").then(setData).catch(setError);
  useEffect(() => { load(); }, []);
  const points = useMemo(() => (data ? data.plots.map((p) => [p.plot.lat, p.plot.lon]) : []), [data]);

  const saveMeas = async (e) => {
    e.preventDefault();
    await api.post("/map/measurements", { lat: pending[0], lon: pending[1], kind: form.kind, value: Number(form.value), note: form.note });
    setPending(null); setAdding(false); setForm({ kind: "ec", value: "", note: "" }); toast(t("map.meas_saved")); load();
  };
  const delMeas = async (id) => { await api.del(`/map/measurements/${id}`); load(); };

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner />;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t("map.title")}</h1><p>{t("map.sub")}</p></div>
        <Button className={adding ? "" : "ghost"} onClick={() => { setAdding(!adding); setPending(null); }}><Crosshair size={16} />{t("map.add_meas")}</Button></div>

      <div className="layer-chips" role="group">
        {layers.map((l) => <button key={l} className={`chip ${layer === l ? "active" : ""}`} onClick={() => setLayer(l)}>{t(`map.layers.${l}`)}</button>)}
        <span className="legend-scale" style={{ marginInlineStart: "auto" }}>{t("map.legend.low")}<i style={{ background: LEGEND[layer] }} />{t("map.legend.high")}</span>
      </div>
      {adding && !pending && <Notice tone="info">{t("map.meas_mode")}</Notice>}

      <div className="map-box">
        <MapContainer center={region.map.center} zoom={region.map.zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Fit points={points} />
          <Clicker active={adding} onPick={(la, lo) => setPending([Number(la.toFixed(5)), Number(lo.toFixed(5))])} />
          {data.plots.map((i) => {
            const lv = layerValue(layer, i, limit);
            const text = {
              stress: t("map.v_stress", { v: num(lv.v, lang, 2) }), moisture: t("map.v_moisture", { v: num(lv.v, lang, 0) }), salinity: t("map.v_salinity", { v: num(lv.v, lang, 0) }),
              leaching: t("map.v_leaching", { v: num(lv.v, lang, 0) }), solar: t("map.v_solar", { v: num(lv.v, lang, 0) }), nitrate: lv.v == null ? "–" : t("map.v_nitrate", { v: num(lv.v, lang, 0) }),
            }[layer];
            return (
              <CircleMarker key={i.plot.id} center={[i.plot.lat, i.plot.lon]} radius={Math.min(26, 10 + Math.sqrt(i.plot.area_ha) * 2.5)} pathOptions={{ color: "#fff", weight: 3, fillColor: lv.color, fillOpacity: 0.92 }}>
                <Popup><b>{i.plot.name}</b><br />{pick(i.crop.name, lang)}<br />{text}<br /><Link to={`/plots/${i.plot.id}`}>{t("map.open")}</Link></Popup>
              </CircleMarker>
            );
          })}
          {data.measurements.map((m) => (
            <CircleMarker key={`m${m.id}`} center={[m.lat, m.lon]} radius={6} pathOptions={{ color: MEAS_COLOR[m.kind], weight: 3, fillColor: "#fff", fillOpacity: 1 }}>
              <Popup>{t(`map.meas.${m.kind}`)}: <b>{num(m.value, lang, 2)}</b><br />{dateLong(m.date, lang)}{m.note ? <><br />{m.note}</> : null}<br /><button className="btn danger sm" onClick={() => delMeas(m.id)} style={{ marginTop: 6 }}><Trash2 size={12} /></button></Popup>
            </CircleMarker>
          ))}
          {pending && <CircleMarker center={pending} radius={7} pathOptions={{ color: "#52514e", weight: 3, fillColor: "#fff", fillOpacity: 1, dashArray: "3 3" }} />}
        </MapContainer>
      </div>
      <div className="tiny muted">{t("map.basemap")}</div>

      {pending && (
        <Card title={t("map.add_meas")}>
          <form className="stack" onSubmit={saveMeas}>
            <div className="form-grid">
              <Field label={t("map.meas_kind")}><select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{["ec", "moisture", "ph"].map((k) => <option key={k} value={k}>{t(`map.meas.${k}`)}</option>)}</select></Field>
              <Field label={t("map.meas_value")}><input className="input" type="number" step="any" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
              <Field label={t("note")}><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} /></Field>
            </div>
            <div className="row"><Button type="submit">{t("save")}</Button><Button type="button" className="ghost" onClick={() => setPending(null)}>{t("cancel")}</Button></div>
          </form>
        </Card>
      )}
      {toastEl}
    </div>
  );
}
