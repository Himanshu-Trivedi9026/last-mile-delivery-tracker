"use client";

import { useEffect } from "react";
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

function normalizeStatus(
  value: string | null | undefined
) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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
  const mappedOrders =
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
    });

  return (
    <div className="h-full w-full">
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
              `${pickupLatitude}-${pickupLongitude}-${deliveryLatitude}-${deliveryLongitude}-${index}`;

            return (
              <span key={orderKey}>
                {/* PICKUP MARKER */}
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
                    <div className="min-w-[180px]">
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

                {/* ROUTE */}
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
                    color: "#475569",
                    weight: 3,
                    opacity: 0.75,
                    dashArray: "8 8",
                  }}
                />

                {/* DELIVERY MARKER */}
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
                    <div className="min-w-[180px]">
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
    </div>
  );
}
