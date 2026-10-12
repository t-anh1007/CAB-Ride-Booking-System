import L from "leaflet";
import { Circle, Marker } from "react-leaflet";
import { BaseMap } from "@cab/web-shared";
import { levelColors } from "../data/demo.js";

const carIcon = (heading = 0) => L.divIcon({
  className: "ad-car",
  html: `<span style="transform:rotate(${heading}deg)"><svg viewBox="0 0 24 24" width="16" height="16"><rect x="7" y="3" width="10" height="18" rx="4" fill="#10231D"/><rect x="8.5" y="6" width="7" height="4" rx="1.5" fill="#9fb3ab"/><rect x="8.5" y="15" width="7" height="3" rx="1.2" fill="#9fb3ab"/></svg></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export function MapLegend() {
  const demand = ["Thấp", "Trung bình", "Cao", "Rất cao"];
  const surge = ["1.0x", "1.2x – 1.5x", "1.6x – 2.0x", "> 2.0x"];
  return <aside className="ad-legend" aria-label="Chú giải bản đồ">
    <h3>Nhu cầu (hiện tại)</h3>
    <ul>{demand.map((label, i) => <li key={label}><i style={{ background: levelColors[i] }} />{label}</li>)}</ul>
    <h3>Hệ số giá (Surge)</h3>
    <ul>{surge.map((label, i) => <li key={label}><i style={{ background: levelColors[i] }} />{label}</li>)}</ul>
  </aside>;
}

export default function OpsMap({ zones = [], drivers = [], className = "" }) {
  return <div className={`ad-map ${className}`}>
    <BaseMap className="ad-map__leaflet" zoom={14}>
      {zones.map((zone, i) => <Circle key={i} center={zone.center} radius={zone.radius}
        pathOptions={{ color: levelColors[zone.level], fillColor: levelColors[zone.level], fillOpacity: 0.32, weight: 0 }} />)}
      {drivers.map(driver => <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={carIcon(driver.heading)} />)}
    </BaseMap>
    <MapLegend />
  </div>;
}
