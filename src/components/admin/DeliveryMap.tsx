"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

/* ============================================================
   TYPES
============================================================ */

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

type RouteResult = {
  key: string;
  route: RouteData | null;
  error: string | null;
};

/* ============================================================
   MODULE-LEVEL ROUTE CACHE
============================================================ */

/*
 * This cache survives component re-renders and prevents
 * requesting the same pickup → delivery route repeatedly.
 */
const routeCache = new Map<
  string,
  RouteData
>();

/*
 * If two components/effects request the same route while the
 * first request is still running, they share the same Promise.
 */
const routeInFlight = new Map<
  string,
  Promise<RouteData>
>();

/* ============================================================
   HELPERS
============================================================ */

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
  if (!Number.isFinite(meters)) {
    return "Unavailable";
  }

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
  if (!Number.isFinite(seconds)) {
    return "Unavailable";
  }

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

function formatStatus(
  value: string | null | undefined
) {
  return String(
    value ?? "unknown"
  )
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function getOrderKey(
  order: DeliveryOrder,
  index: number
) {
  return (
    order.id ??
    order.order_number ??
    `route-${index}`
  );
}

function getRouteKey(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number
) {
  return [
    pickupLat.toFixed(6),
    pickupLng.toFixed(6),
    deliveryLat.toFixed(6),
    deliveryLng.toFixed(6),
  ].join(":");
}

/* ============================================================
   ROUTE REQUEST
============================================================ */

async function requestRoute(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number
): Promise<RouteData> {
  const routeKey = getRouteKey(
    pickupLat,
    pickupLng,
    deliveryLat,
    deliveryLng
  );

  /*
   * Return cached route immediately.
   */
  const cached =
    routeCache.get(routeKey);

  if (cached) {
    return cached;
  }

  /*
   * If another request for exactly the same route is already
   * running, reuse that Promise.
   */
  const existingRequest =
    routeInFlight.get(routeKey);

  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise =
    (async () => {
      let lastError: unknown =
        null;

      /*
       * Retry once for temporary network/server failures.
       */
      for (
        let attempt = 1;
        attempt <= 2;
        attempt++
      ) {
        try {
          const controller =
            new AbortController();

          const timeoutId =
            window.setTimeout(() => {
              controller.abort();
            }, 15000);

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

                  signal:
                    controller.signal,
                }
              );

            const data =
              await response.json();

            if (
              !response.ok ||
              !data.success ||
              !data.route
            ) {
              throw new Error(
                data.error ??
                  "Route calculation failed."
              );
            }

            const route: RouteData =
              {
                coordinates:
                  Array.isArray(
                    data.route.coordinates
                  )
                    ? data.route.coordinates
                    : [],

                distanceMeters:
                  Number(
                    data.route
                      .distanceMeters
                  ),

                durationSeconds:
                  Number(
                    data.route
                      .durationSeconds
                  ),
              };

            if (
              route.coordinates.length <
              2
            ) {
              throw new Error(
                "Invalid route coordinates."
              );
            }

            /*
             * Save successful route.
             */
            routeCache.set(
              routeKey,
              route
            );

            return route;
          } finally {
            window.clearTimeout(
              timeoutId
            );
          }
        } catch (error) {
          lastError = error;

          /*
           * Small delay before retry.
           */
          if (attempt < 2) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  500
                )
            );
          }
        }
      }

      throw (
        lastError instanceof Error
          ? lastError
          : new Error(
              "Route request failed."
            )
      );
    })();

  routeInFlight.set(
    routeKey,
    requestPromise
  );

  try {
    return await requestPromise;
  } finally {
    routeInFlight.delete(
      routeKey
    );
  }
}

/* ============================================================
   MAP FITTING
============================================================ */

function FitMapToOrders({
  orders,
}: {
  orders: DeliveryOrder[];
}) {
  const map = useMap();

  useEffect(() => {
    const points =
      orders
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
            Number.isFinite(
              point.lat
            ) &&
            Number.isFinite(
              point.lng
            )
        );

    if (
      points.length === 0
    ) {
      return;
    }

    if (
      points.length === 1
    ) {
      map.setView(
        [
          points[0].lat,
          points[0].lng,
        ],
        13
      );

      return;
    }

    const bounds =
      points.map(
        (point) =>
          [
            point.lat,
            point.lng,
          ] as [
            number,
            number
          ]
      );

    map.fitBounds(
      bounds,
      {
        padding: [
          40,
          40,
        ],

        maxZoom: 12,
      }
    );
  }, [
    map,
    orders,
  ]);

  return null;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function DeliveryMap({
  orders,
}: DeliveryMapProps) {
  /* ----------------------------------------------------------
     ONLY ORDERS WITH COMPLETE COORDINATES
  ---------------------------------------------------------- */

  const mappedOrders =
    useMemo(
      () =>
        orders.filter(
          (order) => {
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

            return (
              Number.isFinite(
                pickupLat
              ) &&
              Number.isFinite(
                pickupLng
              ) &&
              Number.isFinite(
                deliveryLat
              ) &&
              Number.isFinite(
                deliveryLng
              )
            );
          }
        ),
      [orders]
    );

  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */

  const [
    routes,
    setRoutes,
  ] = useState<
    Record<
      string,
      RouteData
    >
  >({});

  const [
    routeErrors,
    setRouteErrors,
  ] = useState<
    Record<
      string,
      string
    >
  >({});

  const [
    routing,
    setRouting,
  ] = useState(false);

  /* ==========================================================
     LOAD ROAD ROUTES
  ========================================================== */

  useEffect(() => {
    let cancelled =
      false;

    async function loadRoutes() {
      if (
        mappedOrders.length ===
        0
      ) {
        setRoutes({});
        setRouteErrors({});
        setRouting(false);

        return;
      }

      /*
       * Only request routes that are not already available.
       */
      const pendingOrders =
        mappedOrders.filter(
          (order, index) => {
            const key =
              getOrderKey(
                order,
                index
              );

            return !routes[key];
          }
        );

      if (
        pendingOrders.length ===
        0
      ) {
        setRouting(false);

        return;
      }

      setRouting(true);

      /*
       * IMPORTANT:
       *
       * Do NOT use Promise.all() on every order.
       *
       * We process only two routes simultaneously.
       */
      const CONCURRENCY = 2;

      const nextRoutes: Record<
        string,
        RouteData
      > = {
        ...routes,
      };

      const nextErrors: Record<
        string,
        string
      > = {
        ...routeErrors,
      };

      for (
        let startIndex = 0;
        startIndex <
        pendingOrders.length;
        startIndex +=
          CONCURRENCY
      ) {
        if (
          cancelled
        ) {
          return;
        }

        const batch =
          pendingOrders.slice(
            startIndex,
            startIndex +
              CONCURRENCY
          );

        const results: RouteResult[] =
          await Promise.all(
            batch.map(
              async (
                order,
                batchIndex
              ) => {
                const actualIndex =
                  startIndex +
                  batchIndex;

                const key =
                  getOrderKey(
                    order,
                    actualIndex
                  );

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
                  const route =
                    await requestRoute(
                      pickupLat,
                      pickupLng,
                      deliveryLat,
                      deliveryLng
                    );

                  return {
                    key,
                    route,
                    error: null,
                  };
                } catch (error) {
                  console.error(
                    `Route calculation failed for ${key}:`,
                    error
                  );

                  return {
                    key,
                    route: null,
                    error:
                      "Road route unavailable.",
                  };
                }
              }
            )
          );

        if (
          cancelled
        ) {
          return;
        }

        for (
          const result of results
        ) {
          if (
            result.route
          ) {
            nextRoutes[
              result.key
            ] =
              result.route;

            delete nextErrors[
              result.key
            ];
          } else if (
            result.error
          ) {
            nextErrors[
              result.key
            ] =
              result.error;
          }
        }

        /*
         * Progressive UI update.
         */
        setRoutes({
          ...nextRoutes,
        });

        setRouteErrors({
          ...nextErrors,
        });

        /*
         * Small pause between batches.
         *
         * This prevents a burst of requests against OSRM.
         */
        if (
          startIndex +
            CONCURRENCY <
          pendingOrders.length
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );
        }
      }

      if (
        !cancelled
      ) {
        setRouting(false);
      }
    }

    loadRoutes();

    return () => {
      cancelled = true;
    };

    /*
     * Intentionally depend only on mappedOrders.
     *
     * If routes were included here, every setRoutes()
     * could trigger the routing effect again.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mappedOrders,
  ]);

  /* ==========================================================
     MAP
  ========================================================== */

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[
          23.2584857,
          77.401989,
        ]}
        zoom={11}
        scrollWheelZoom={
          true
        }
        className="h-full w-full"
      >
        {/* ====================================================
            OPENSTREETMAP TILES
        ==================================================== */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ====================================================
            AUTOMATIC MAP FIT
        ==================================================== */}

        <FitMapToOrders
          orders={
            mappedOrders
          }
        />

        {/* ====================================================
            ORDERS
        ==================================================== */}

        {mappedOrders.map(
          (
            order,
            index
          ) => {
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
              status ===
                "failed" ||
              status ===
                "rescheduled";

            const orderKey =
              getOrderKey(
                order,
                index
              );

            const route =
              routes[
                orderKey
              ];

            const routeError =
              routeErrors[
                orderKey
              ];

            /*
             * If OSRM fails, display a straight line between
             * pickup and delivery instead of showing nothing.
             */
            const fallbackLine:
              [
                number,
                number
              ][] = [
              [
                pickupLatitude,
                pickupLongitude,
              ],

              [
                deliveryLatitude,
                deliveryLongitude,
              ],
            ];

            return (
              <Fragment
                key={
                  orderKey
                }
              >
                {/* =================================================
                    PICKUP MARKER
                ================================================= */}

                <CircleMarker
                  center={[
                    pickupLatitude,
                    pickupLongitude,
                  ]}
                  radius={7}
                  pathOptions={{
                    color:
                      "#ffffff",

                    weight: 2,

                    fillColor:
                      "#16a34a",

                    fillOpacity:
                      0.95,
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="text-xs font-bold text-slate-900">
                        {order.order_number ??
                          "Pickup"}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        Pickup location
                      </p>

                      {order.pickup_address && (
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">
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

                {/* =================================================
                    REAL ROAD ROUTE
                ================================================= */}

                {route ? (
                  <Polyline
                    positions={
                      route.coordinates
                    }
                    pathOptions={{
                      color:
                        "#2563eb",

                      weight: 4,

                      opacity:
                        0.85,
                    }}
                  />
                ) : (
                  /*
                   * Fallback while the real road route is loading
                   * or unavailable.
                   */
                  <Polyline
                    positions={
                      fallbackLine
                    }
                    pathOptions={{
                      color:
                        "#64748b",

                      weight: 3,

                      opacity:
                        0.55,

                      dashArray:
                        "8 8",
                    }}
                  />
                )}

                {/* =================================================
                    DELIVERY MARKER
                ================================================= */}

                <CircleMarker
                  center={[
                    deliveryLatitude,
                    deliveryLongitude,
                  ]}
                  radius={8}
                  pathOptions={{
                    color:
                      "#ffffff",

                    weight: 2,

                    fillColor:
                      attentionRequired
                        ? "#ef4444"
                        : "#2563eb",

                    fillOpacity:
                      0.95,
                  }}
                >
                  <Popup>
                    <div className="min-w-[210px]">
                      {/* ORDER NUMBER */}

                      <p className="text-xs font-bold text-slate-900">
                        {order.order_number ??
                          "Delivery"}
                      </p>

                      {/* STATUS */}

                      <p className="mt-1 text-[11px] font-medium text-slate-600">
                        {formatStatus(
                          order.status
                        )}
                      </p>

                      {/* DELIVERY */}

                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Delivery location
                      </p>

                      {order.delivery_address && (
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">
                          {
                            order.delivery_address
                          }
                        </p>
                      )}

                      {/* ROUTE INFORMATION */}

                      {route && (
                        <div className="mt-3 rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
                            Road route
                          </p>

                          <p className="mt-1 text-[11px] text-slate-600">
                            Distance:{" "}
                            <span className="font-semibold text-slate-800">
                              {formatDistance(
                                route.distanceMeters
                              )}
                            </span>
                          </p>

                          <p className="mt-1 text-[11px] text-slate-600">
                            Estimated time:{" "}
                            <span className="font-semibold text-slate-800">
                              {formatDuration(
                                route.durationSeconds
                              )}
                            </span>
                          </p>
                        </div>
                      )}

                      {/* ROUTE ERROR */}

                      {routeError &&
                        !route && (
                          <p className="mt-2 rounded-md bg-amber-50 p-2 text-[10px] leading-4 text-amber-700">
                            {routeError}
                            <br />
                            Showing direct
                            pickup-to-delivery
                            line.
                          </p>
                        )}

                      {/* COORDINATES */}

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
              </Fragment>
            );
          }
        )}
      </MapContainer>

      {/* ========================================================
          ROUTING STATUS
      ======================================================== */}

      {routing && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur">
          Calculating road routes...
        </div>
      )}

      {/* ========================================================
          ROUTE COUNT
      ======================================================== */}

      {!routing &&
        Object.keys(
          routes
        ).length > 0 && (
          <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur">
            {
              Object.keys(
                routes
              ).length
            }{" "}
            road{" "}
            {Object.keys(
              routes
            ).length === 1
              ? "route"
              : "routes"}
          </div>
        )}

      {/* ========================================================
          NO ROUTES
      ======================================================== */}

      {!routing &&
        mappedOrders.length >
          0 &&
        Object.keys(
          routes
        ).length === 0 && (
          <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-lg border border-amber-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-amber-700 shadow-sm backdrop-blur">
            Road routes unavailable
          </div>
        )}

      {/* ========================================================
          LEGEND
      ======================================================== */}

      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" />

          Pickup
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />

          Delivery
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />

          Attention required
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
          <span className="h-0.5 w-5 bg-blue-600" />

          Road route
        </div>
      </div>
    </div>
  );
}