// components/MapView.jsx
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🎨 Custom marker icons for each point
const createIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

// Define colors for each type
const markerColors = {
  current: "green",
  pickup: "orange",
  dropoff: "red",
};

const FitBounds = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    const coords = positions.filter(Boolean);
    if (coords.length === 0) return;
    if (coords.length === 1) map.setView(coords[0], 10);
    else map.fitBounds(coords, { padding: [40, 40] });
  }, [positions, map]);
  return null;
};

export default function MapView({ points = [] }) {
  const positions = points.map((p) => p?.coords).filter(Boolean);
  const center = positions[0] || [48.8566, 2.3522]; // Default: Paris

  // build color polyline (we can use blue or multi-colored if needed)
  return (
    <div style={{ marginTop: "1rem" }}>
      <MapContainer
        style={{
          height: "380px",
          width: "100%",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
        center={center}
        zoom={6}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map(
          (p, idx) =>
            p &&
            p.coords && (
              <Marker
                key={idx}
                position={p.coords}
                icon={
                  p.type === "current"
                    ? createIcon(markerColors.current)
                    : p.type === "pickup"
                    ? createIcon(markerColors.pickup)
                    : createIcon(markerColors.dropoff)
                }
              >
                <Popup>
                  <div style={{ fontWeight: "bold" }}>{p.label}</div>
                  {p.address && <div style={{ fontSize: 12 }}>{p.address}</div>}
                </Popup>
              </Marker>
            )
        )}

        {positions.length >= 2 && <Polyline positions={positions} color="blue" weight={4} />}

        <FitBounds positions={positions} />
      </MapContainer>

      {/* 🗺️ Legend Section */}
      <div
        style={{
          marginTop: "10px",
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          fontSize: "14px",
        }}
      >
        <LegendItem color={markerColors.current} label="Current Location" />
        <LegendItem color={markerColors.pickup} label="Pickup Location" />
        <LegendItem color={markerColors.dropoff} label="Dropoff Location" />
        <LegendItem color="blue" label="Travel Route" line />
      </div>
    </div>
  );
}

// 🧩 Small component for the legend items
function LegendItem({ color, label, line = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {line ? (
        <div
          style={{
            width: "20px",
            height: "3px",
            backgroundColor: color,
            borderRadius: "2px",
          }}
        />
      ) : (
        <div
          style={{
            width: "15px",
            height: "15px",
            borderRadius: "50%",
            backgroundColor: color,
            border: "1px solid #333",
          }}
        />
      )}
      <span>{label}</span>
    </div>
  );
}
