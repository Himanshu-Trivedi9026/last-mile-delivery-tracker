"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  pickup_address: string;
  delivery_address: string;
  package_weight: number;
  package_type: string;
  delivery_type: string;
  payment_method: string;
  order_amount: number;
  delivery_fee: number;
  cod_surcharge: number;
  status: string;
  assigned_agent_id: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  updated_at: string;
};

type TrackingEvent = {
  id: string;
  status: string;
  description: string;
  location: string | null;
  created_at: string;
};

type OrderResponse = {
  success: boolean;
  order?: Order;
  error?: string;
};

type TrackingResponse = {
  success: boolean;
  events?: TrackingEvent[];
  error?: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatStatus(status: string) {
  return (
    statusLabels[status] ||
    status.replaceAll("_", " ").replace(/\b\w/g, (char) =>
      char.toUpperCase()
    )
  );
}

function formatDate(date: string | null) {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function CustomerOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return;

    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/orders/${orderId}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data: OrderResponse = await response.json();

        if (!response.ok || !data.success || !data.order) {
          setError(
            data.error || "Unable to load order details."
          );
          return;
        }

        setOrder(data.order);
      } catch {
        setError(
          "Unable to connect to the order service."
        );
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    async function loadTracking() {
      try {
        setTrackingLoading(true);

        const response = await fetch(
          `/api/orders/${orderId}/tracking`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data: TrackingResponse = await response.json();

        if (response.ok && data.success) {
          setTracking(data.events || []);
        }
      } catch {
        // Tracking failure should not prevent
        // the order details from being displayed.
      } finally {
        setTrackingLoading(false);
      }
    }

    loadTracking();
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-lg bg-slate-200" />
            <div className="h-32 rounded-2xl bg-white shadow-sm" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-72 rounded-2xl bg-white shadow-sm" />
              <div className="h-72 rounded-2xl bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to My Orders
          </button>

          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Unable to Load Order
            </h1>

            <p className="mt-3 text-slate-600">
              {error || "Order could not be found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const totalAmount =
    Number(order.order_amount || 0) +
    Number(order.delivery_fee || 0) +
    Number(order.cod_surcharge || 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">

        {/* Back */}
        <button
          type="button"
          onClick={() => router.push("/dashboard/customer")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          ← Back to My Orders
        </button>

        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Order Details
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                {order.order_number}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Created {formatDateTime(order.created_at)}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                order.status === "delivered"
                  ? "bg-emerald-100 text-emerald-700"
                  : order.status === "cancelled"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              {formatStatus(order.status)}
            </span>
          </div>
        </section>

        {/* Route */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Delivery Route
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Pickup and delivery information
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Pickup */}
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  P
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pickup
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {order.pickup_address}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  D
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Delivery
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {order.delivery_address}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main information */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* Package */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Package Information
            </h2>

            <div className="mt-6 space-y-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">
                  Package Type
                </span>

                <span className="font-semibold text-slate-900">
                  {order.package_type}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">
                  Weight
                </span>

                <span className="font-semibold text-slate-900">
                  {order.package_weight} kg
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Delivery Type
                </span>

                <span className="font-semibold capitalize text-slate-900">
                  {order.delivery_type.replaceAll("_", " ")}
                </span>
              </div>

            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Payment Information
            </h2>

            <div className="mt-6 space-y-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">
                  Order Amount
                </span>

                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.order_amount)}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">
                  Delivery Fee
                </span>

                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.delivery_fee)}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">
                  COD Surcharge
                </span>

                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.cod_surcharge)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Total
                </span>

                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="pt-2">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {order.payment_method}
                </span>
              </div>

            </div>
          </section>
        </div>

        {/* Expected delivery */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Expected Delivery
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Estimated delivery date for this order
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 px-5 py-3 font-semibold text-blue-700">
              {formatDate(order.expected_delivery_date)}
            </div>
          </div>
        </section>

        {/* Tracking timeline */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900">
              Delivery Timeline
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Track the progress of your order
            </p>
          </div>

          {trackingLoading ? (
            <div className="space-y-5">
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : tracking.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="font-medium text-slate-700">
                No tracking events yet.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Tracking information will appear here once your
                order starts moving.
              </p>
            </div>
          ) : (
            <div className="relative space-y-7">
              {tracking.map((event, index) => (
                <div
                  key={event.id}
                  className="relative flex gap-4"
                >
                  {index !== tracking.length - 1 && (
                    <div className="absolute left-4 top-9 h-full w-px bg-slate-200" />
                  )}

                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === tracking.length - 1
                        ? "bg-blue-600 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1 pb-1">
                    <div className="flex flex-col justify-between gap-2 md:flex-row">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {formatStatus(event.status)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          {event.description}
                        </p>

                        {event.location && (
                          <p className="mt-1 text-xs text-slate-500">
                            📍 {event.location}
                          </p>
                        )}
                      </div>

                      <time className="text-xs text-slate-400">
                        {formatDateTime(event.created_at)}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 pb-10 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/dashboard/customer")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Back to My Orders
          </button>

          <button
  type="button"
  onClick={() =>
    router.push(
      `/dashboard/customer/orders/${orderId}/tracking`
    )
  }
  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
>
  View Tracking
</button>
        </div>

      </div>
    </main>
  );
}