"use client";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

type LiveRoutingMapProps = {
  latitude: number | null;
  longitude: number | null;
  destination: string | null;
  orderNumber: string | null;
};

function MapController({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (latitude == null || longitude == null) {
      return;
    }

    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    });
  }, [latitude, longitude, map]);

  return null;
}

export default function LiveRoutingMap({
  latitude,
  longitude,
  destination,
  orderNumber,
}: LiveRoutingMapProps) {
  const hasLocation =
    latitude != null && longitude != null;

  // Bhopal fallback so the map is still a real, clickable map
  // before browser GPS permission is granted.
  const center: [number, number] = hasLocation
    ? [latitude!, longitude!]
    : [23.2599, 77.4126];

  return (
    <div className="relative h-full min-h-[430px] w-full">
      <MapContainer
        center={center}
        zoom={hasLocation ? 15 : 12}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        touchZoom={true}
        keyboard={true}
        zoomControl={true}
        attributionControl={true}
        className="h-full min-h-[430px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          latitude={latitude}
          longitude={longitude}
        />

        {hasLocation && (
          <CircleMarker
            center={[latitude!, longitude!]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#0058be",
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div className="min-w-[170px] text-sm">
                <div className="font-bold text-slate-900">
                  Current Agent Location
                </div>

                {orderNumber && (
                  <div className="mt-1 font-mono text-xs text-slate-600">
                    {orderNumber}
                  </div>
                )}

                <div className="mt-2 font-mono text-xs text-slate-600">
                  {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {!hasLocation && (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-[1000]">
          <div className="rounded-lg border border-[#c6c6cd] bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-sm font-semibold text-[#0b1c30]">
              Waiting for GPS location
            </div>

            <div className="mt-1 text-xs leading-4 text-[#45464d]">
              Allow location access in your browser to
              show your current position on the live map.
            </div>
          </div>
        </div>
      )}

      {destination && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] max-w-[220px] rounded-lg border border-[#c6c6cd] bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold text-[#0b1c30]">
            Destination
          </div>

          <div className="mt-1 text-[11px] leading-4 text-[#45464d]">
            {destination}
          </div>
        </div>
      )}
    </div>
  );
}