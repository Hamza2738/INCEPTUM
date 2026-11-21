import React from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Clicker({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Small map used to place a plot. No marker image assets, so it bundles cleanly.
export default function MapPicker({ lat, lon, center, zoom, onPick }) {
  const has = lat != null && lon != null && lat !== "" && lon !== "";
  return (
    <div className="map-box sm">
      <MapContainer center={has ? [Number(lat), Number(lon)] : center} zoom={has ? 9 : zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker onPick={onPick} />
        {has && <CircleMarker center={[Number(lat), Number(lon)]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#0B5D5E", fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
}
