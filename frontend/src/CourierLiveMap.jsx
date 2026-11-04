
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const courierIcon = L.divIcon({
  className: "teztaom-courier-marker",
  html: '<div style="font-size:30px">🛵</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function FollowCourier({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], 16);
  }, [map, latitude, longitude]);

  return null;
}

export default function CourierLiveMap({ location }) {
  if (!location) {
    return (
      <div style={{
        padding: 16,
        borderRadius: 12,
        background: "#181b21",
        color: "#ccc",
        marginTop: 14,
      }}>
        Курьер GPS жойлашуви кутилмоқда...
      </div>
    );
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return <p>Курьер жойлашуви ҳозирча мавжуд эмас.</p>;
  }

  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ marginBottom: 10 }}>📍 Курьернинг жойлашуви</h3>

      <div style={{
        height: 320,
        width: "100%",
        overflow: "hidden",
        borderRadius: 14,
      }}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FollowCourier
            latitude={latitude}
            longitude={longitude}
          />

          <Marker
            position={[latitude, longitude]}
            icon={courierIcon}
          >
            <Popup>TezTaom курьери</Popup>
          </Marker>
        </MapContainer>
      </div>

      <small style={{ color: "#999" }}>
        Харита ҳар 5 секундда янгиланади.
      </small>
    </div>
  );
}
