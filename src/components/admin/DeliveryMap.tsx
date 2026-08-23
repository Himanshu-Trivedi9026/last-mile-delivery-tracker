"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type DeliveryOrder = {
  id?: string;
  order_number?: string | null;
  status?: string | null;

  pickup_address?: string | null;
  delivery_address?: string | null;

  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;

  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
};

type DeliveryMapProps = {
  orders: DeliveryOrder[];
};

type RouteData = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

function normalizeStatus(
  value: string | null | undefined
) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatDistance(
  meters: number
) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}

function formatDuration(
  seconds: number
) {
  const minutes = Math.round(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  const remainingMinutes =
    minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function FitMapToOrders({
  orders,
}: {
  orders: DeliveryOrder[];
}) {
  const map = useMap();

  useEffect(() => {
    const points = orders
      .flatMap((order) => [
        {
          lat: Number(
            order.pickup_latitude
          ),
          lng: Number(
            order.pickup_longitude
          ),
        },
        {
          lat: Number(
            order.delivery_latitude
          ),
          lng: Number(
            order.delivery_longitude
          ),
        },
      ])
      .filter(
        (point) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng)
      );

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(
        [
          points[0].lat,
          points[0].lng,
        ],
        13
      );

      return;
    }

    const bounds = points.map(
      (point) =>
        [
          point.lat,
          point.lng,
        ] as [number, number]
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 12,
    });
  }, [map, orders]);

  return null;
}

export default function DeliveryMap({
  orders,
}: DeliveryMapProps) {
  const mappedOrders = useMemo(
    () =>
      orders.filter((order) => {
        const pickupLat = Number(
          order.pickup_latitude
        );

        const pickupLng = Number(
          order.pickup_longitude
        );

        const deliveryLat = Number(
          order.delivery_latitude
        );

        const deliveryLng = Number(
          order.delivery_longitude
        );

        return (
          Number.isFinite(pickupLat) &&
          Number.isFinite(pickupLng) &&
          Number.isFinite(deliveryLat) &&
          Number.isFinite(deliveryLng)
        );
      }),
    [orders]
  );

  const [routes, setRoutes] =
    useState<
      Record<string, RouteData>
    >({});

  const [routeErrors, setRouteErrors] =
    useState<Record<string, string>>(
      {}
    );

  const [routing, setRouting] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      if (mappedOrders.length === 0) {
        setRoutes({});
        setRouteErrors({});
        setRouting(false);
        return;
      }

      setRouting(true);

      const results =
        await Promise.all(
          mappedOrders.map(
            async (order, index) => {
              const key =
                order.id ??
                order.order_number ??
                `route-${index}`;

              const pickupLat =
                Number(
                  order.pickup_latitude
                );

              const pickupLng =
                Number(
                  order.pickup_longitude
                );

              const deliveryLat =
                Number(
                  order.delivery_latitude
                );

              const deliveryLng =
                Number(
                  order.delivery_longitude
                );

              try {
                const response =
                  await fetch(
                    "/api/routes",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body: JSON.stringify({
                        start: {
                          lat: pickupLat,
                          lng: pickupLng,
                        },
                        end: {
                          lat: deliveryLat,
                          lng: deliveryLng,
                        },
                      }),
                    }
                  );

                const data =
                  await response.json();

                if (
                  !response.ok ||
                  !data.success ||
                  !data.route
                ) {
                  return {
                    key,
                    route: null,
                    error:
                      data.error ??
                      "Could not calculate route.",
                  };
                }

                return {
                  key,
                  route:
                    data.route as RouteData,
                  error: null,
                };
              } catch (error) {
                console.error(
                  `Route request failed for ${key}:`,
                  error
                );

                return {
                  key,
                  route: null,
                  error:
                    "Route service unavailable.",
                };
              }
            }
          )
        );

      if (cancelled) {
        return;
      }

      const nextRoutes: Record<
        string,
        RouteData
      > = {};

      const nextErrors: Record<
        string,
        string
      > = {};

      for (const result of results) {
        if (result.route) {
          nextRoutes[result.key] =
            result.route;
        } else if (result.error) {
          nextErrors[result.key] =
            result.error;
        }
      }

      setRoutes(nextRoutes);
      setRouteErrors(nextErrors);
      setRouting(false);
    }

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [mappedOrders]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[
          23.2584857,
          77.401989,
        ]}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapToOrders
          orders={mappedOrders}
        />

        {mappedOrders.map(
          (order, index) => {
            const pickupLatitude =
              Number(
                order.pickup_latitude
              );

            const pickupLongitude =
              Number(
                order.pickup_longitude
              );

            const deliveryLatitude =
              Number(
                order.delivery_latitude
              );

            const deliveryLongitude =
              Number(
                order.delivery_longitude
              );

            const status =
              normalizeStatus(
                order.status
              );

            const attentionRequired =
              status === "failed" ||
              status === "rescheduled";

            const orderKey =
              order.id ??
              order.order_number ??
              `route-${index}`;

            const route =
              routes[orderKey];

            const routeError =
              routeErrors[orderKey];

            return (
              <span key={orderKey}>
                {/* ==========================================
                    PICKUP MARKER
                ========================================== */}

                <CircleMarker
                  center={[
                    pickupLatitude,
                    pickupLongitude,
                  ]}
                  radius={7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#16a34a",
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="min-w-[190px]">
                      <p className="text-xs font-bold text-slate-900">
                        {order.order_number ??
                          "Pickup"}
                      </p>

                      <p className="mt-2 text-[10px] font-semibold text-green-700">
                        Pickup location
                      </p>

                      {order.pickup_address && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {
                            order.pickup_address
                          }
                        </p>
                      )}

                      <p className="mt-2 text-[10px] text-slate-400">
                        {pickupLatitude.toFixed(
                          5
                        )}
                        ,{" "}
                        {pickupLongitude.toFixed(
                          5
                        )}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>

                {/* ==========================================
                    ACTUAL ROAD ROUTE
                ========================================== */}

                {route ? (
                  <Polyline
                    positions={
                      route.coordinates
                    }
                    pathOptions={{
                      color:
                        attentionRequired
                          ? "#ef4444"
                          : "#2563eb",
                      weight: 4,
                      opacity: 0.85,
                    }}
                  >
                    <Popup>
                      <div className="min-w-[190px]">
                        <p className="text-xs font-bold text-slate-900">
                          {order.order_number ??
                            "Delivery route"}
                        </p>

                        <p className="mt-2 text-[10px] font-semibold text-blue-700">
                          Road route
                        </p>

                        <p className="mt-1 text-[11px] text-slate-600">
                          Distance:{" "}
                          {formatDistance(
                            route.distanceMeters
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-600">
                          Estimated time:{" "}
                          {formatDuration(
                            route.durationSeconds
                          )}
                        </p>
                      </div>
                    </Popup>
                  </Polyline>
                ) : (
                  <Polyline
                    positions={[
                      [
                        pickupLatitude,
                        pickupLongitude,
                      ],
                      [
                        deliveryLatitude,
                        deliveryLongitude,
                      ],
                    ]}
                    pathOptions={{
                      color: "#94a3b8",
                      weight: 3,
                      opacity: 0.65,
                      dashArray: "8 8",
                    }}
                  />
                )}

                {/* ==========================================
                    DELIVERY MARKER
                ========================================== */}

                <CircleMarker
                  center={[
                    deliveryLatitude,
                    deliveryLongitude,
                  ]}
                  radius={8}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor:
                      attentionRequired
                        ? "#ef4444"
                        : "#2563eb",
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="text-xs font-bold text-slate-900">
                        {order.order_number ??
                          "Delivery"}
                      </p>

                      <p className="mt-1 text-[11px] capitalize text-slate-600">
                        {String(
                          order.status ??
                            "unknown"
                        ).replace(
                          /_/g,
                          " "
                        )}
                      </p>

                      <p className="mt-2 text-[10px] font-semibold text-blue-700">
                        Delivery location
                      </p>

                      {order.delivery_address && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {
                            order.delivery_address
                          }
                        </p>
                      )}

                      {route && (
                        <>
                          <p className="mt-2 text-[10px] font-semibold text-slate-700">
                            Route information
                          </p>

                          <p className="mt-1 text-[11px] text-slate-500">
                            Distance:{" "}
                            {formatDistance(
                              route.distanceMeters
                            )}
                          </p>

                          <p className="mt-1 text-[11px] text-slate-500">
                            Estimated time:{" "}
                            {formatDuration(
                              route.durationSeconds
                            )}
                          </p>
                        </>
                      )}

                      {routeError && (
                        <p className="mt-2 text-[10px] text-amber-600">
                          {routeError}
                        </p>
                      )}

                      <p className="mt-2 text-[10px] text-slate-400">
                        {deliveryLatitude.toFixed(
                          5
                        )}
                        ,{" "}
                        {deliveryLongitude.toFixed(
                          5
                        )}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              </span>
            );
          }
        )}
      </MapContainer>

      {/* ================================================
          ROUTING STATUS
      ================================================ */}

      {routing && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur">
          Calculating road routes...
        </div>
      )}

      {!routing &&
        mappedOrders.length > 0 &&
        Object.keys(routes).length > 0 && (
          <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur">
            {Object.keys(routes).length} road routes
          </div>
        )}

      {!routing &&
        mappedOrders.length > 0 &&
        Object.keys(routes).length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-[10px] font-semibold text-amber-700 shadow-sm backdrop-blur">
            Road routes unavailable
          </div>
        )}
    </div>
  );
}