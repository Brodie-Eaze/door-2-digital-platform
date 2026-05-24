'use client';

import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Austin East Residential — sample territory polygon (real lat/lng)
const TERRITORY: [number, number][] = [
  [30.252, -97.748],
  [30.252, -97.735],
  [30.241, -97.732],
  [30.238, -97.743],
  [30.244, -97.75],
  [30.252, -97.748],
];

const CENTER: [number, number] = [30.2456, -97.7415];

// Knock pins with disposition colours
const KNOCKS: Array<{ pos: [number, number]; color: string; label: string }> = [
  { pos: [30.2475, -97.7405], color: '#1D4ED8', label: 'Maria Santos · SALE' },
  { pos: [30.2467, -97.7445], color: '#1D4ED8', label: 'David Chen · LEAD' },
  { pos: [30.2455, -97.7395], color: '#475569', label: 'Not home' },
  { pos: [30.2483, -97.7438], color: '#475569', label: 'Not home' },
  { pos: [30.2425, -97.742], color: '#1D4ED8', label: 'Jennifer López · SALE' },
  { pos: [30.244, -97.7375], color: '#0F172A', label: 'Do not knock' },
  { pos: [30.2495, -97.746], color: '#1D4ED8', label: 'Sophia Patel · LEAD' },
  { pos: [30.2412, -97.739], color: '#F59E0B', label: 'Callback Tue 3pm' },
];

// Current Noctua position
const ME: [number, number] = [30.2461, -97.7418];

export default function NoctuaPhoneMapImpl(): JSX.Element {
  return (
    <MapContainer
      center={CENTER}
      zoom={17}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging={true}
      doubleClickZoom={true}
    >
      {/* Esri World Imagery — real satellite tiles, no API key needed */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri"
        maxZoom={19}
      />

      {/* Hybrid labels (street names + boundaries) overlaid on satellite */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        attribution=""
        maxZoom={19}
        opacity={0.85}
      />

      {/* Assigned territory polygon */}
      <Polygon
        positions={TERRITORY}
        pathOptions={{
          color: '#3B82F6',
          weight: 2.5,
          opacity: 0.95,
          fillColor: '#3B82F6',
          fillOpacity: 0.18,
        }}
      />

      {/* Knock pins */}
      {KNOCKS.map((k, i) => (
        <CircleMarker
          key={i}
          center={k.pos}
          radius={5}
          pathOptions={{
            color: 'white',
            weight: 2,
            fillColor: k.color,
            fillOpacity: 1,
          }}
        >
          <Tooltip>{k.label}</Tooltip>
        </CircleMarker>
      ))}

      {/* Noctua current location (pulsing accent dot) */}
      <CircleMarker
        center={ME}
        radius={8}
        pathOptions={{
          color: 'white',
          weight: 3,
          fillColor: '#3B82F6',
          fillOpacity: 1,
        }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]} className="noctua-me-tooltip">
          You
        </Tooltip>
      </CircleMarker>

      {/* Outer halo for the "me" dot */}
      <CircleMarker
        center={ME}
        radius={16}
        pathOptions={{
          color: '#3B82F6',
          weight: 1,
          fillColor: '#3B82F6',
          fillOpacity: 0.15,
        }}
      />
    </MapContainer>
  );
}
