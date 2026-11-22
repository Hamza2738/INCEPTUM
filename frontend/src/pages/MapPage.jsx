import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleMarker, GeoJSON, MapContainer, Popup, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
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
    case "stress": { const v = i.ks_today ?? 1; return { v, color: v >= 0.90 ? OK : v >= 0.75 ? WARN : RISK }; }
    case "moisture": { const v = i.moisture_remaining ?? (i.depletion_pct_raw == null ? null : 100 - i.depletion_pct_raw); return { v, color: v == null ? "#898781" : v >= 70 ? OK : v >= 40 ? WARN : RISK }; }
    case "salinity": { const v = i.yield_rel ?? 100; return { v, color: v >= 95 ? OK : v >= 85 ? WARN : RISK }; }
    case "leaching": { const v = (i.lr ?? 0) * 100; return { v, color: v <= 10 ? OK : v <= 25 ? WARN : RISK }; }
    case "solar": { const v = i.ghi ?? 0; return { v, color: v >= 1800 ? OK : v >= 1300 ? WARN : RISK }; }
    case "nitrate": { const v = i.nitrate_mg_l; return { v, color: v == null ? "#898781" : v <= (limit || 10) ? OK : v <= (limit || 10) * 2 ? WARN : RISK }; }
    default: return { v: null, color: "#898781" };
  }
}
const LEGEND = { stress: STATUS_CSS, moisture: STATUS_CSS, salinity: STATUS_CSS, leaching: STATUS_CSS, solar: STATUS_CSS, nitrate: STATUS_CSS };
const MEAS_COLOR = { ec: "#eb6834", moisture: "#2a78d6", ph: "#1baf7a" };

const COVERAGE_BOUNDS = {
  TN: { south: 30.2, north: 37.5, west: 7.3, east: 11.7, latStep: 0.35, lonStep: 0.42 },
  JP: { south: 30.8, north: 45.7, west: 129.2, east: 145.9, latStep: 0.75, lonStep: 1.05 },
};

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon, lat, geometry) {
  if (!geometry) return true;
  if (geometry.type === "Polygon") {
    return pointInRing(lon, lat, geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInRing(lon, lat, polygon[0]));
  }
  return false;
}

function regionalBaseline(regionId, layer, lat, lon) {
  if (regionId === "TN") {
    if (layer === "stress") {
      if (lat >= 36.2) return 0.92;
      if (lat >= 34.5) return 0.86;
      if (lat >= 32.5) return 0.78;
      return 0.72;
    }
    if (layer === "moisture") {
      if (lat >= 36.2) return 82;
      if (lat >= 34.5) return 72;
      if (lat >= 32.5) return 62;
      return 52;
    }
    if (layer === "salinity") {
      if (lat >= 36.2) return 96;
      if (lat >= 34.5) return 92;
      if (lat >= 32.5) return 86;
      return 80;
    }
    if (layer === "leaching") {
      if (lat >= 36.2) return 8;
      if (lat >= 34.5) return 14;
      if (lat >= 32.5) return 22;
      return 30;
    }
    if (layer === "solar") {
      if (lat >= 36.2) return 1850;
      if (lat >= 34.5) return 2000;
      if (lat >= 32.5) return 2100;
      return 2200;
    }
    if (layer === "nitrate") {
      if (lat >= 36.2) return 4;
      if (lat >= 34.5) return 6;
      if (lat >= 32.5) return 8;
      return 7;
    }
  }

  if (layer === "stress") {
    if (lat >= 40) return 0.93;
    if (lat >= 36) return 0.88;
    if (lat >= 33) return 0.82;
    return 0.78;
  }
  if (layer === "moisture") {
    if (lat >= 40) return 72;
    if (lat >= 36) return 68;
    if (lat >= 33) return 64;
    return 62;
  }
  if (layer === "salinity") {
    if (lat >= 38) return 96;
    if (lat >= 34) return 93;
    return 89;
  }
  if (layer === "leaching") {
    if (lat >= 40) return 8;
    if (lat >= 36) return 12;
    if (lat >= 33) return 16;
    return 20;
  }
  if (layer === "solar") {
    if (lat >= 40) return 1320;
    if (lat >= 36) return 1450;
    if (lat >= 33) return 1580;
    return 1680;
  }
  if (layer === "nitrate") {
    if (lat >= 40) return 5;
    if (lat >= 36) return 7;
    if (lat >= 33) return 9;
    return 11;
  }
  return null;
}

function getCountryGeometry(boundaries, regionId) {
  const countryName = regionId === "TN" ? "Tunisia" : "Japan";
  return boundaries?.features?.find((feature) => feature.properties?.ADMIN === countryName)?.geometry || null;
}

function estimateInCountry(estimate, geometry) {
  if (!geometry) return true;
  return pointInPolygon(estimate.lon, estimate.lat, geometry);
}

const ESTIMATE_KEY = { stress: "ks_today", moisture: "moisture_remaining", salinity: "yield_rel", leaching: "lr", solar: "ghi", nitrate: "nitrate_mg_l" };

function estimateValue(layer, estimate) {
  const v = estimate[ESTIMATE_KEY[layer]];
  if (v == null) return null;
  return layer === "leaching" ? v * 100 : v;
}

function colorFor(layer, value, limit) {
  if (value == null) return "#898781";
  const item = { stress: { ks_today: value }, moisture: { moisture_remaining: value }, salinity: { yield_rel: value },
    leaching: { lr: value / 100 }, solar: { ghi: value }, nitrate: { nitrate_mg_l: value } }[layer];
  return item ? layerValue(layer, item, limit).color : "#898781";
}

function makeCoverage(regionId, layer, boundaries, regionalEstimates, limit) {
  const geometry = getCountryGeometry(boundaries, regionId);

  let base;
  if (regionalEstimates?.length) {
    base = regionalEstimates
      .filter((estimate) => estimateInCountry(estimate, geometry))
      .map((estimate) => ({ lat: estimate.lat, lon: estimate.lon, bounds: estimate.bounds, value: estimateValue(layer, estimate), source: estimate.source }));
  } else {
    const b = COVERAGE_BOUNDS[regionId] || COVERAGE_BOUNDS.TN;
    base = [];
    for (let lat = b.south; lat < b.north; lat += b.latStep) {
      for (let lon = b.west; lon < b.east; lon += b.lonStep) {
        const cLat = lat + b.latStep / 2, cLon = lon + b.lonStep / 2;
        if (geometry && !pointInPolygon(cLon, cLat, geometry)) continue;
        base.push({ lat: cLat, lon: cLon, bounds: [[lat, lon], [lat + b.latStep, lon + b.lonStep]], value: regionalBaseline(regionId, layer, cLat, cLon) });
      }
    }
  }

  return base.map((cell) => ({ bounds: cell.bounds, value: cell.value, color: colorFor(layer, cell.value, limit), source: cell.source }));
}

function Fit({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    map.invalidateSize();
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 8 });
    else if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 7));
  }, [key]); // eslint-disable-line
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
  const [boundaries, setBoundaries] = useState(null);
  const [, toast, toastEl] = useToast();

  const load = () => api.get("/map/overview").then(setData).catch(setError);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch("/countries.geojson")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("boundaries unavailable")))
      .then(setBoundaries)
      .catch(() => setBoundaries(null));
  }, []);
  const points = useMemo(() => (data ? data.plots.filter((p) => Number.isFinite(p.plot?.lat) && Number.isFinite(p.plot?.lon)).map((p) => [p.plot.lat, p.plot.lon]) : []), [data]);
  const coverage = useMemo(() => data ? makeCoverage(region.id, layer, boundaries, data.regional_estimates, limit) : [], [data?.regional_estimates, layer, region.id, boundaries, limit]);

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

      <div className="map-stat-grid">
        <Card className="map-stat"><span className="tiny muted">{t("map.plot_count")}</span><b className="num">{data.plots.length}</b></Card>
        <Card className="map-stat"><span className="tiny muted">{t("map.measurement_count")}</span><b className="num">{data.measurements.length}</b></Card>
        <Card className="map-stat"><span className="tiny muted">{t("map.active_layer")}</span><b>{t(`map.layers.${layer}`)}</b></Card>
      </div>
      <div className="layer-chips" role="group">
        {layers.map((l) => <button key={l} className={`chip ${layer === l ? "active" : ""}`} onClick={() => setLayer(l)}>{t(`map.layers.${l}`)}</button>)}
        <span className="legend-scale map-legend-bands" style={{ marginInlineStart: "auto" }}>
          <span><i style={{ background: OK }} />{t("map.legend.good")}</span>
          <span><i style={{ background: WARN }} />{t("map.legend.medium")}</span>
          <span><i style={{ background: RISK }} />{t("map.legend.risk")}</span>
        </span>
      </div>
      <div className="map-legend-threshold">{t(`map.threshold.${layer}`, { limit: limit || 10 })}</div>
      {adding && !pending && <Notice tone="info">{t("map.meas_mode")}</Notice>}

      <div className="map-box">
        <MapContainer center={region.map.center} zoom={region.map.zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Fit points={points} />
          <Clicker active={adding} onPick={(la, lo) => setPending([Number(la.toFixed(5)), Number(lo.toFixed(5))])} />
          {boundaries && (
            <GeoJSON
              data={{
                ...boundaries,
                features: boundaries.features.filter((feature) =>
                  region.id === "TN"
                    ? feature.properties?.ADMIN === "Tunisia"
                    : feature.properties?.ADMIN === "Japan"
                ),
              }}
              style={{ color: region.id === "TN" ? "#2DD4BF" : "#A5B4FC", weight: 2.5, fillOpacity: 0, opacity: 0.95 }}
            />
          )}
          {coverage.map((cell, index) => {
            const text = {
              stress: t("map.v_stress", { v: num(cell.value, lang, 2) }),
              moisture: t("map.v_moisture", { v: num(cell.value, lang, 0) }),
              salinity: t("map.v_salinity", { v: num(cell.value, lang, 0) }),
              leaching: t("map.v_leaching", { v: num(cell.value, lang, 0) }),
              solar: t("map.v_solar", { v: num(cell.value, lang, 0) }),
              nitrate: cell.value == null ? "–" : t("map.v_nitrate", { v: num(cell.value, lang, 0) }),
            }[layer];
            return (
              <Rectangle
                key={`coverage-${index}`}
                bounds={cell.bounds}
                pathOptions={{ color: cell.color, weight: 0.5, fillColor: cell.color, fillOpacity: 0.26, opacity: 0.28 }}
                interactive={!adding}
              >
                <Tooltip direction="top" opacity={0.95}>{text}<br /><span className="tiny muted">{cell.source || t("map.regional_estimate")}</span></Tooltip>
              </Rectangle>
            );
          })}
          {data.plots.filter((i) => Number.isFinite(i.plot?.lat) && Number.isFinite(i.plot?.lon)).map((i) => {
            const lv = layerValue(layer, i, limit);
            const text = {
              stress: t("map.v_stress", { v: num(lv.v, lang, 2) }), moisture: t("map.v_moisture", { v: num(lv.v, lang, 0) }), salinity: t("map.v_salinity", { v: num(lv.v, lang, 0) }),
              leaching: t("map.v_leaching", { v: num(lv.v, lang, 0) }), solar: t("map.v_solar", { v: num(lv.v, lang, 0) }), nitrate: lv.v == null ? "–" : t("map.v_nitrate", { v: num(lv.v, lang, 0) }),
            }[layer];
            return (
              <CircleMarker key={i.plot.id} center={[i.plot.lat, i.plot.lon]} radius={Math.min(26, 10 + Math.sqrt(Math.max(0, Number(i.plot.area_ha) || 0)) * 2.5)} pathOptions={{ color: "#fff", weight: 3, fillColor: lv.color, fillOpacity: 0.92 }}>
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
