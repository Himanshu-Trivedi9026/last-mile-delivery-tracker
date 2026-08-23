"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type DeliveryOrder = {
  id?: string;
  order_number?: string | null;
  status?: string | null;
  delivery_address?: string | null;
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
};

type DeliveryMapProps = {
  orders: DeliveryOrder[];
};

function normalizeStatus(value: string | null | undefined) {
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
      .map((order) => ({
        lat: Number(order.delivery_latitude),
        lng: Number(order.delivery_longitude),
      }))
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
        [points[0].lat, points[0].lng],
        13
      );
      return;
    }

    const bounds = points.map(
      (point) =>
        [point.lat, point.lng] as [
          number,
          number
        ]
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
  const mappedOrders = orders.filter((order) => {
    const lat = Number(
      order.delivery_latitude
    );
    const lng = Number(
      order.delivery_longitude
    );

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    );
  });

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[
          23.2584857,
          77.4019890,
        ]}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapToOrders
          orders={mappedOrders}
        />

        {mappedOrders.map((order, index) => {
          const latitude = Number(
            order.delivery_latitude
          );

          const longitude = Number(
            order.delivery_longitude
          );

          const status =
            normalizeStatus(order.status);

          const attentionRequired =
            status === "failed" ||
            status === "rescheduled";

          return (
            <CircleMarker
              key={
                order.id ??
                order.order_number ??
                `${latitude}-${longitude}-${index}`
              }
              center={[
                latitude,
                longitude,
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

                  {order.delivery_address && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {order.delivery_address}
                    </p>
                  )}

                  <p className="mt-2 text-[10px] text-slate-400">
                    {latitude.toFixed(5)},{" "}
                    {longitude.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
