"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LiveAgentLocation = {
  id: string;
  full_name: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  updated_at: string | null;
};

type LiveAgentTrackingMapProps = {
  agent: LiveAgentLocation | null;
  destinationLatitude: number | string | null;
  destinationLongitude: number | string | null;
  destinationAddress?: string | null;
};

type RouteData = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) {
    return "Unavailable";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "Unavailable";
  }

  const minutes = Math.max(
    1,
    Math.round(seconds / 60)
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0
    ? `${hours} hr`
    : `${hours} hr ${remaining} min`;
}

function MapController({
  agentPosition,
  destinationPosition,
}: {
  agentPosition: [number, number] | null;
  destinationPosition: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (!agentPosition) {
      map.setView(destinationPosition, 13);
      return;
    }

    const bounds = L.latLngBounds([
      agentPosition,
      destinationPosition,
    ]);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15,
    });
  }, [
    map,
    agentPosition?.[0],
    agentPosition?.[1],
    destinationPosition[0],
    destinationPosition[1],
  ]);

  return null;
}

function AgentMarker({
  position,
  agentName,
}: {
  position: [number, number];
  agentName: string;
}) {
  const icon = useMemo(() => {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #2563eb;
          border: 4px solid white;
          box-shadow: 0 3px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        ">
          🚚
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }, []);

  return (
    <Marker
      position={position}
      icon={icon}
    >
      <Popup>
        <div className="min-w-[180px]">
          <p className="font-bold text-slate-900">
            {agentName || "Delivery Agent"}
          </p>

          <p className="mt-1 text-sm text-green-600">
            ● Live Location
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {position[0].toFixed(6)},{" "}
            {position[1].toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function LiveAgentTrackingMap({
  agent,
  destinationLatitude,
  destinationLongitude,
  destinationAddress,
}: LiveAgentTrackingMapProps) {
  const destinationPosition = useMemo(() => {
    const lat = Number(destinationLatitude);
    const lng = Number(destinationLongitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return [lat, lng] as [number, number];
  }, [
    destinationLatitude,
    destinationLongitude,
  ]);

  const agentPosition = useMemo(() => {
    if (!agent) {
      return null;
    }

    const lat = Number(
      agent.current_latitude
    );

    const lng = Number(
      agent.current_longitude
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return [lat, lng] as [number, number];
  }, [
    agent?.current_latitude,
    agent?.current_longitude,
  ]);

  const [route, setRoute] =
    useState<RouteData | null>(null);

  const [routeLoading, setRouteLoading] =
    useState(false);

  useEffect(() => {
    if (
      !agentPosition ||
      !destinationPosition
    ) {
      setRoute(null);
      return;
    }

    let cancelled = false;

    async function loadRoute() {
      try {
        setRouteLoading(true);

        const response = await fetch(
          "/api/routes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              start: {
                lat: agentPosition![0],
                lng: agentPosition![1],
              },
              end: {
                lat: destinationPosition![0],
                lng: destinationPosition![1],
              },
            }),
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to calculate route."
          );
        }

        if (!cancelled) {
          setRoute(data.route ?? null);
        }
      } catch (error) {
        console.warn(
          "Live agent route error:",
          error
        );

        if (!cancelled) {
          setRoute(null);
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    agentPosition?.[0],
    agentPosition?.[1],
    destinationPosition?.[0],
    destinationPosition?.[1],
  ]);

  if (!destinationPosition) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <p className="text-sm font-medium text-slate-500">
          Delivery location is not available.
        </p>
      </div>
    );
  }

  const center =
    agentPosition ?? destinationPosition;

  const fallbackLine =
    agentPosition
      ? [
          agentPosition,
          destinationPosition,
        ]
      : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />

            <h3 className="font-bold text-slate-900">
              Live Delivery Tracking
            </h3>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {agent
              ? `${agent.full_name || "Delivery Agent"} • GPS location`
              : "Waiting for agent location..."}
          </p>
        </div>

        {route && (
          <div className="flex gap-4 text-sm">
            <div>
              <p className="font-bold text-slate-900">
                {formatDistance(
                  route.distanceMeters
                )}
              </p>
              <p className="text-xs text-slate-500">
                Distance
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-900">
                {formatDuration(
                  route.durationSeconds
                )}
              </p>
              <p className="text-xs text-slate-500">
                ETA
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative h-[420px]">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            agentPosition={agentPosition}
            destinationPosition={
              destinationPosition
            }
          />

          {agentPosition && (
            <AgentMarker
              position={agentPosition}
              agentName={
                agent?.full_name ||
                "Delivery Agent"
              }
            />
          )}

          <CircleMarker
            center={destinationPosition}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#dc2626",
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div>
                <p className="font-bold">
                  Delivery Destination
                </p>

                {destinationAddress && (
                  <p className="mt-1 text-sm text-slate-600">
                    {destinationAddress}
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  {destinationPosition[0].toFixed(
                    6
                  )}
                  ,{" "}
                  {destinationPosition[1].toFixed(
                    6
                  )}
                </p>
              </div>
            </Popup>
          </CircleMarker>

          {route ? (
            <Polyline
              positions={route.coordinates}
              pathOptions={{
                color: "#2563eb",
                weight: 5,
                opacity: 0.85,
              }}
            />
          ) : (
            fallbackLine.length === 2 && (
              <Polyline
                positions={fallbackLine}
                pathOptions={{
                  color: "#64748b",
                  weight: 4,
                  opacity: 0.7,
                  dashArray: "8 8",
                }}
              />
            )
          )}
        </MapContainer>

        {routeLoading && (
          <div className="absolute right-3 top-3 z-[1000] rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-md">
            Updating route...
          </div>
        )}

        {!agentPosition && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            Waiting for the delivery agent's
            GPS location.
          </div>
        )}
      </div>
    </div>
  );
}
