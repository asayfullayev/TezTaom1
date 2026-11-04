import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [39.7747, 64.4286];

const markerIcon = L.divIcon({
  className: "teztaom-location-marker",
  html: '<div style="font-size:30px;line-height:34px">📍</div>',
  iconSize: [34, 38],
  iconAnchor: [17, 36],
});

const LAYERS = {
  street: {
    label: "Ko‘cha xaritasi",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    label: "Sun’iy yo‘ldosh",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  osm: {
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  topo: {
    label: "Topografik",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

function ClickToChoose({ onChoose }) {
  useMapEvents({
    click(event) {
      onChoose({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        label: "",
      });
    },
  });
  return null;
}

function MoveMap({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], 16);
  }, [map, point?.lat, point?.lng]);
  return null;
}

export default function LocationPicker({ onSelect }) {
  const [point, setPoint] = useState(null);
  const [query, setQuery] = useState("");
  const [layerName, setLayerName] = useState("street");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choosePoint(nextPoint) {
    setPoint(nextPoint);
    setError("");
    onSelect?.(nextPoint);
  }

  async function searchAddress(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(value)}`
      );
      if (!response.ok) throw new Error("Manzil qidiruvi vaqtincha ishlamayapti.");
      const results = await response.json();
      if (!results.length) throw new Error("Manzil topilmadi. Boshqa nom bilan qidiring.");
      const result = results[0];
      const nextPoint = {
        lat: Number(result.lat),
        lng: Number(result.lon),
        label: result.display_name || value,
      };
      choosePoint(nextPoint);
    } catch (err) {
      setError(err.message || "Manzilni qidirishda xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  }

  function locateMe() {
    setError("");
    if (!navigator.geolocation) {
      setError("Brauzer GPS joylashuvini aniqlashni qo‘llamaydi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        choosePoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Mening GPS joylashuvim",
        });
      },
      (err) => setError(`GPS joylashuvini olib bo‘lmadi: ${err.message}`),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  const layer = LAYERS[layerName];

  return (
    <div className="teztaom-location-picker" style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#181b21", border: "1px solid #30343d" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ color: "#f5f5f5" }}>📍 Xaritadan manzil tanlang</strong>
        <button type="button" onClick={locateMe} style={{ padding: "8px 10px", borderRadius: 8, border: 0, cursor: "pointer" }}>
          🎯 Mening joylashuvim
        </button>
      </div>

      <form onSubmit={searchAddress} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Manzil qidirish (masalan, Buxoro)"
          aria-label="Manzil qidirish"
          style={{ minWidth: 0, flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #424752", background: "#111318", color: "#fff" }}
        />
        <button type="submit" disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, border: 0, cursor: "pointer" }}>
          {busy ? "Qidirilmoqda..." : "Qidirish"}
        </button>
      </form>

      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#d1d5db", fontSize: 13, marginBottom: 10 }}>
        Xarita turi
        <select value={layerName} onChange={(event) => setLayerName(event.target.value)} style={{ padding: 7, borderRadius: 7, background: "#111318", color: "#fff", border: "1px solid #424752" }}>
          {Object.entries(LAYERS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
        </select>
      </label>

      <div style={{ height: 300, width: "100%", overflow: "hidden", borderRadius: 10 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer key={layerName} url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
          <ClickToChoose onChoose={choosePoint} />
          <MoveMap point={point} />
          {point && (
            <Marker
              position={[point.lat, point.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const position = event.target.getLatLng();
                  choosePoint({ lat: position.lat, lng: position.lng, label: point.label || "" });
                },
              }}
            >
              <Popup>Yetkazib berish manzili</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <p style={{ color: "#b7bec9", fontSize: 12, margin: "9px 0 0" }}>
        Xaritani bosing yoki belgini kerakli joyga surинг.
      </p>
      {point && (
        <div style={{ color: "#f5f5f5", fontSize: 12, marginTop: 6, overflowWrap: "anywhere" }}>
          <strong>Tanlangan nuqta:</strong> {point.label ? `${point.label} · ` : ""}
          {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        </div>
      )}
      {error && <p role="alert" style={{ color: "#ff9b9b", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
