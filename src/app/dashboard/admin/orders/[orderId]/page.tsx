
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "rescheduled"
  | "cancelled";

type Order = {
  id: string;
  order_number: string;
  customer_id: string;

  pickup_address: string;
  delivery_address: string;

  package_weight: number;
  package_type: string;

  package_length: number | null;
  package_width: number | null;
  package_height: number | null;

  volumetric_weight: number | null;
  chargeable_weight: number | null;

  order_type: string | null;
  delivery_type: string;
  payment_method: string;

  order_amount: number;
  delivery_fee: number;
  cod_surcharge: number;

  status: OrderStatus;

  assigned_agent_id: string | null;

  pickup_zone_id: string | null;
  delivery_zone_id: string | null;

  expected_delivery_date: string | null;

  created_at: string;
  updated_at: string;

  failure_reason: string | null;
  failed_at: string | null;
  rescheduled_date: string | null;

  delivery_attempt: number;
};

type OrderResponse = {
  success: boolean;
  order?: Order;
  error?: string;
};

function formatStatus(status: OrderStatus) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusClasses(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";

    case "confirmed":
      return "bg-blue-100 text-blue-800";

    case "assigned":
      return "bg-purple-100 text-purple-800";

    case "picked_up":
      return "bg-indigo-100 text-indigo-800";

    case "in_transit":
      return "bg-cyan-100 text-cyan-800";

    case "out_for_delivery":
      return "bg-orange-100 text-orange-800";

    case "delivered":
      return "bg-green-100 text-green-800";

    case "failed":
      return "bg-red-100 text-red-800";

    case "rescheduled":
      return "bg-pink-100 text-pink-800";

    case "cancelled":
      return "bg-gray-200 text-gray-800";

    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

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
  }).format(Number(value) || 0);
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-gray-100 py-4 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-semibold text-gray-900">
        {value === null || value === undefined || value === ""
          ? "—"
          : value}
      </span>
    </div>
  );
}

export default function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleSuccess, setRescheduleSuccess] = useState("");

  async function handleReschedule() {
    if (!order) {
      return;
    }

    if (rescheduling) {
      return;
    }

    setRescheduleError("");
    setRescheduleSuccess("");

    if (order.status !== "failed") {
      setRescheduleError(
        "Only a failed delivery can be rescheduled."
      );
      return;
    }

    if (!rescheduledDate) {
      setRescheduleError(
        "Please select a new delivery date."
      );
      return;
    }

    const selectedDate = new Date(
      `${rescheduledDate}T00:00:00`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setRescheduleError(
        "Rescheduled date cannot be in the past."
      );
      return;
    }

    try {
      setRescheduling(true);

      const response = await fetch(
        `/api/orders/${order.id}/tracking`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "rescheduled",
            rescheduled_date: rescheduledDate,
            description:
              "Delivery rescheduled by administrator.",
          }),
        }
      );

      const data: {
        success: boolean;
        error?: string;
        order?: Order;
      } = await response.json();

      if (!response.ok || !data.success || !data.order) {
        throw new Error(
          data.error ||
            "Failed to reschedule the delivery."
        );
      }

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              ...data.order,
            }
          : currentOrder
      );
      setRescheduleSuccess(
        `Delivery rescheduled for ${formatDate(
          data.order.rescheduled_date
        )}.`
      );
      setRescheduledDate("");
    } catch (err) {
      console.error("Reschedule delivery error:", err);

      setRescheduleError(
        err instanceof Error
          ? err.message
          : "Failed to reschedule the delivery."
      );
    } finally {
      setRescheduling(false);
    }
  }

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const { orderId } = await params;

        const response = await fetch(`/api/orders/${orderId}`, {
          method: "GET",
          cache: "no-store",
        });

        const data: OrderResponse = await response.json();

        if (!response.ok || !data.success || !data.order) {
          throw new Error(data.error || "Failed to load order.");
        }

        setOrder(data.order);
      } catch (err) {
        console.error("Admin order details error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load order."
        );
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              <p className="mt-4 text-sm text-gray-600">
                Loading order details...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard/admin/orders"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to Orders
          </Link>

          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <h1 className="text-xl font-bold text-red-800">
              Unable to Load Order
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error || "Order not found."}
            </p>

            <Link
              href="/dashboard/admin/orders"
              className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const total =
    Number(order.order_amount) +
    Number(order.delivery_fee) +
    Number(order.cod_surcharge);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Back */}
        <div className="mb-6">
          <Link
            href="/dashboard/admin/orders"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to Order Management
          </Link>
        </div>

        {/* Header */}
        <section className="mb-6 rounded-xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
                Admin Order Details
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {order.order_number}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Created {formatDateTime(order.created_at)}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(
                order.status
              )}`}
            >
              {formatStatus(order.status)}
            </span>
          </div>
        </section>

        {/* Route */}
        <section className="mb-6 rounded-xl bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Delivery Route
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pickup and delivery information
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Pickup
              </p>

              <p className="mt-3 text-base font-semibold text-gray-900">
                {order.pickup_address}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Zone: {order.pickup_zone_id || "Not assigned"}
              </p>
            </div>

            <div className="rounded-xl border border-green-100 bg-green-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Delivery
              </p>

              <p className="mt-3 text-base font-semibold text-gray-900">
                {order.delivery_address}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Zone: {order.delivery_zone_id || "Not assigned"}
              </p>
            </div>
          </div>
        </section>

        {/* Main information */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Package */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Package Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Shipment and weight information
            </p>

            <div className="mt-5">
              <InfoRow
                label="Package Type"
                value={order.package_type}
              />

              <InfoRow
                label="Actual Weight"
                value={`${order.package_weight} kg`}
              />

              <InfoRow
                label="Volumetric Weight"
                value={
                  order.volumetric_weight !== null
                    ? `${order.volumetric_weight} kg`
                    : "—"
                }
              />

              <InfoRow
                label="Chargeable Weight"
                value={
                  order.chargeable_weight !== null
                    ? `${order.chargeable_weight} kg`
                    : "—"
                }
              />

              <InfoRow
                label="Dimensions"
                value={
                  order.package_length !== null &&
                  order.package_width !== null &&
                  order.package_height !== null
                    ? `${order.package_length} × ${order.package_width} × ${order.package_height} cm`
                    : "—"
                }
              />

              <InfoRow
                label="Order Type"
                value={order.order_type}
              />

              <InfoRow
                label="Delivery Type"
                value={order.delivery_type}
              />
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Payment Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Charges and payment details
            </p>

            <div className="mt-5">
              <InfoRow
                label="Order Amount"
                value={formatCurrency(order.order_amount)}
              />

              <InfoRow
                label="Delivery Fee"
                value={formatCurrency(order.delivery_fee)}
              />

              <InfoRow
                label="COD Surcharge"
                value={formatCurrency(order.cod_surcharge)}
              />

              <InfoRow
                label="Payment Method"
                value={order.payment_method}
              />

              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-5">
                <span className="text-base font-bold text-gray-900">
                  Total
                </span>

                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </section>

          {/* Customer */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Customer Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Customer associated with this order
            </p>

            <div className="mt-5">
              <InfoRow
                label="Customer ID"
                value={order.customer_id}
              />

              <InfoRow
                label="Order Number"
                value={order.order_number}
              />

              <InfoRow
                label="Created"
                value={formatDateTime(order.created_at)}
              />

              <InfoRow
                label="Last Updated"
                value={formatDateTime(order.updated_at)}
              />
            </div>
          </section>

          {/* Agent */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Delivery Agent
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Current assignment information
            </p>

            <div className="mt-5">
              <InfoRow
                label="Assignment"
                value={
                  order.assigned_agent_id
                    ? "Assigned"
                    : "Unassigned"
                }
              />

              <InfoRow
                label="Agent ID"
                value={order.assigned_agent_id}
              />

              <InfoRow
                label="Delivery Attempt"
                value={order.delivery_attempt}
              />
            </div>

            {!order.assigned_agent_id && (
              <div className="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-semibold text-yellow-800">
                  This order has not been assigned to a delivery agent.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Delivery status */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold text-gray-900">
            Delivery Status
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Current delivery state and exception information
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Current Status
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatStatus(order.status)}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Expected Delivery
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatDate(order.expected_delivery_date)}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Delivery Attempt
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {order.delivery_attempt}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Rescheduled Date
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatDate(order.rescheduled_date)}
              </p>
            </div>
          </div>

          {order.status === "failed" && order.failure_reason && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Failed Delivery Reason
              </p>

              <p className="mt-1 text-sm text-red-700">
                {order.failure_reason}
              </p>

              {order.failed_at && (
                <p className="mt-2 text-xs text-red-600">
                  Failed at: {formatDateTime(order.failed_at)}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Admin Actions
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Administrative tools for this order
          </p>

          {order.status === "failed" && (
            <div className="mt-5 rounded-xl border border-pink-200 bg-pink-50 p-5">
              <h3 className="text-lg font-bold text-pink-900">
                Reschedule Delivery
              </h3>

              <p className="mt-1 text-sm text-pink-700">
                Select a new delivery date for this failed order.
              </p>

              <div className="mt-4 max-w-md">
                <label
                  htmlFor="rescheduled-date"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  New Delivery Date *
                </label>

                <input
                  id="rescheduled-date"
                  type="date"
                  value={rescheduledDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(event) => {
                    setRescheduledDate(event.target.value);
                    setRescheduleError("");
                    setRescheduleSuccess("");
                  }}
                  disabled={rescheduling}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                />

                {rescheduleError && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {rescheduleError}
                  </p>
                )}

                {rescheduleSuccess && (
                  <p className="mt-2 text-sm font-medium text-green-600">
                    {rescheduleSuccess}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleReschedule}
                  disabled={rescheduling || !rescheduledDate}
                  className="mt-4 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rescheduling
                    ? "Rescheduling..."
                    : "Reschedule Delivery"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/admin/orders/${order.id}/tracking`}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              View Tracking
            </Link>

            <Link
              href="/dashboard/admin/orders"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back to Orders
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
