"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";


type GPSCoordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function getCurrentGPSPosition(): Promise<GPSCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.warn("GPS location unavailable:", error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}


type Order = {
  id: string;
  order_number: string;

  customer_id: string;
  assigned_agent_id: string | null;

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
  expected_delivery_date: string | null;

  created_at: string;
  updated_at?: string;
};

type TrackingEvent = {
  id: string;
  order_id: string;
  status: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_by: string;
  created_at: string;
};

type OrderResponse = {
  success: boolean;
  order?: Order;
  error?: string;
};

type TrackingResponse = {
  success: boolean;
  currentStatus?: string;
  events?: TrackingEvent[];
  error?: string;
};

const STATUS_FLOW = [
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  failed: "Failed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  assigned: "Order assigned to delivery agent.",
  picked_up: "Package picked up from the customer.",
  in_transit: "Package is currently in transit.",
  out_for_delivery: "Package is out for delivery.",
  delivered: "Package delivered successfully.",
};

const STATUS_LOCATIONS: Record<string, string> = {
  assigned: "Bhopal",
  picked_up: "Pickup location",
  in_transit: "Bhopal",
  out_for_delivery: "Bhopal",
  delivered: "Delivery location",
};

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);

  return (
    STATUS_LABELS[normalized] ||
    normalized
      .split("_")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ")
  );
}

function formatDate(date: string | null | undefined) {
  if (!date) {
    return "Not specified";
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

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function getStatusClass(status: string) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "delivered":
      return "bg-green-100 text-green-700 border-green-200";

    case "out_for_delivery":
      return "bg-purple-100 text-purple-700 border-purple-200";

    case "in_transit":
      return "bg-blue-100 text-blue-700 border-blue-200";

    case "picked_up":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";

    case "assigned":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";

    case "cancelled":
    case "failed":
      return "bg-red-100 text-red-700 border-red-200";

    default:
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }
}

export default function AgentOrderDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const orderId =
    typeof params.orderId === "string"
      ? params.orderId
      : "";

  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [failureReason, setFailureReason] = useState("");

  // ============================================================
  // LOAD ORDER
  // ============================================================

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError("Order ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/orders/${orderId}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data: OrderResponse = await response.json();

      if (!response.ok || !data.success || !data.order) {
        throw new Error(
          data.error || "Failed to load order."
        );
      }

      setOrder(data.order);
    } catch (err) {
      console.error("Load order error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load order."
      );
    }
  }, [orderId]);

  // ============================================================
  // LOAD TRACKING
  // ============================================================

  const loadTracking = useCallback(async () => {
    if (!orderId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orders/${orderId}/tracking`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data: TrackingResponse =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to load tracking information."
        );
      }

      setEvents(data.events ?? []);

      if (data.currentStatus) {
        setOrder((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: data.currentStatus!,
          };
        });
      }
    } catch (err) {
      console.error("Load tracking error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tracking."
      );
    }
  }, [orderId]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    async function loadPage() {
      await loadOrder();
      await loadTracking();
      setLoading(false);
    }

    loadPage();
  }, [loadOrder, loadTracking]);

  // ============================================================
  // CURRENT STATUS
  // ============================================================

  const currentStatus = useMemo(() => {
    return normalizeStatus(order?.status || "pending");
  }, [order?.status]);

  const currentStatusIndex = STATUS_FLOW.indexOf(
    currentStatus as (typeof STATUS_FLOW)[number]
  );

  const nextStatus =
    currentStatus === "rescheduled"
      ? "picked_up"
      : currentStatusIndex >= 0
      ? STATUS_FLOW[currentStatusIndex + 1] ?? null
      : currentStatus === "pending"
      ? "assigned"
      : null;

  const isDelivered =
    currentStatus === "delivered";

  const isCancelled =
    currentStatus === "cancelled";

  // ============================================================
  // UPDATE STATUS
  // ============================================================

  async function handleStatusUpdate(status: string) {
    if (!orderId) {
      return;
    }

    if (updating) {
      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
      const normalizedStatus =
        normalizeStatus(status);

      // Failed delivery requires an explicit failure reason.
      if (normalizedStatus === "failed" && !failureReason.trim()) {
        setError("Failure reason is required.");
        setUpdating(false);
        return;
      }

      // Capture the delivery agent's current GPS position
      // when the tracking event is created.
      const gps = await getCurrentGPSPosition();

      const response = await fetch(
        `/api/orders/${orderId}/tracking`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: normalizedStatus,
            description:
              normalizedStatus === "failed"
                ? failureReason.trim()
                : description.trim() ||
                  STATUS_DESCRIPTIONS[normalizedStatus] ||
                  "",
            location:
              location.trim() ||
              STATUS_LOCATIONS[normalizedStatus] ||
              "",
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.details
            ? `${data.error || "Failed to update order status."} ${data.details}`
            : data.error ||
              "Failed to update order status."
        );
      }

      setSuccessMessage(
        `Order status updated to "${getStatusLabel(
          normalizedStatus
        )}".`
      );

      setDescription("");
      setLocation("");
      setFailureReason("");

      // Refresh both order and tracking data
      await Promise.all([
        loadOrder(),
        loadTracking(),
      ]);
    } catch (err) {
      console.error("Status update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update order status."
      );
    } finally {
      setUpdating(false);
    }
  }

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-5 w-40 animate-pulse rounded bg-gray-200" />

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />

            <div className="mt-4 h-5 w-96 animate-pulse rounded bg-gray-200" />

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error && !order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            ⚠
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Unable to load order
          </h1>

          <p className="mt-3 text-gray-600">
            {error}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setError("");
                loadOrder();
                loadTracking();
              }}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Retry
            </button>

            <button
              onClick={() =>
                router.push(
                  "/dashboard/agent/deliveries"
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  const totalAmount =
    Number(order.order_amount || 0) +
    Number(order.delivery_fee || 0) +
    Number(order.cod_surcharge || 0);

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">

        {/* BACK BUTTON */}
        <button
          onClick={() =>
            router.push(
              "/dashboard/agent/deliveries"
            )
          }
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          ← Back to Deliveries
        </button>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">
            ✓ {successMessage}
          </div>
        )}

        {/* ======================================================
            HEADER
        ====================================================== */}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                Delivery Order
              </p>

              <h1 className="mt-2 break-all text-3xl font-bold text-gray-900">
                {order.order_number}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Created {formatDateTime(order.created_at)}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full border px-5 py-2 text-sm font-bold ${getStatusClass(
                currentStatus
              )}`}
            >
              {getStatusLabel(currentStatus)}
            </span>
          </div>
        </section>

        {/* ======================================================
            UPDATE STATUS
        ====================================================== */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Update Delivery Status
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Move the order through the delivery workflow.
              </p>
            </div>

            {nextStatus && !isDelivered && !isCancelled && (
              <span className="text-sm font-semibold text-gray-500">
                Next:{" "}
                <span className="text-blue-600">
                  {getStatusLabel(nextStatus)}
                </span>
              </span>
            )}
          </div>

          {isDelivered ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="font-bold text-green-800">
                ✓ Delivery completed
              </p>

              <p className="mt-1 text-sm text-green-700">
                This order has already been delivered.
                No further status updates are allowed.
              </p>
            </div>
          ) : isCancelled ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-800">
                Order cancelled
              </p>

              <p className="mt-1 text-sm text-red-700">
                This order cannot receive delivery
                status updates.
              </p>
            </div>
          ) : (
            <>
              {/* FAILURE REASON */}

              {currentStatus === "out_for_delivery" && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-red-800">
                      Delivery Exception
                    </h3>

                    <p className="mt-1 text-sm text-red-700">
                      If the delivery cannot be completed, provide
                      the reason before marking it as failed.
                    </p>
                  </div>

                  <label
                    htmlFor="failure-reason"
                    className="mb-2 block text-sm font-semibold text-red-900"
                  >
                    Failure Reason *
                  </label>

                  <textarea
                    id="failure-reason"
                    value={failureReason}
                    onChange={(event) =>
                      setFailureReason(event.target.value)
                    }
                    placeholder="e.g. Customer was unavailable at the delivery location."
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-red-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />

                  <div className="mt-1 text-right text-xs text-red-600">
                    {failureReason.length}/500
                  </div>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusUpdate("failed")}
                    className="mt-4 rounded-xl border border-red-600 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating
                      ? "Updating..."
                      : "Mark Delivery Failed"}
                  </button>
                </div>
              )}

              {/* OPTIONAL LOCATION / DESCRIPTION */}

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Current Location
                  </label>

                  <input
                    value={location}
                    onChange={(event) =>
                      setLocation(event.target.value)
                    }
                    placeholder="e.g. Bhopal"
                    maxLength={300}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Description
                  </label>

                  <input
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder={
                      STATUS_DESCRIPTIONS[nextStatus || ""] ||
                      "Enter tracking update"
                    }
                    maxLength={500}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

              </div>

              {/* STATUS BUTTONS */}

              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold text-gray-700">
                  Available Status
                </p>

                <div className="flex flex-wrap gap-3">
                  {STATUS_FLOW.map((status, index) => {
                    const isCurrent =
                      currentStatus === status;

                    const isNext =
                      status === nextStatus;

                    const isPast =
                      currentStatusIndex >= 0 &&
                      index < currentStatusIndex;

                    const disabled =
                      updating ||
                      isCurrent ||
                      isPast ||
                      !isNext;

                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          handleStatusUpdate(status)
                        }
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          isNext && !updating
                            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                            : isCurrent
                            ? "cursor-not-allowed border-green-200 bg-green-50 text-green-700"
                            : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        }`}
                      >
                        {updating && isNext
                          ? "Updating..."
                          : getStatusLabel(status)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ======================================================
            DELIVERY ROUTE
        ====================================================== */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Delivery Route
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pickup and delivery locations
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* PICKUP */}

            <div className="rounded-xl border border-gray-200 bg-[#f8faff] p-5">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  P
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Pickup
                  </p>

                  <p className="mt-2 font-semibold text-gray-900">
                    {order.pickup_address}
                  </p>
                </div>
              </div>
            </div>

            {/* DELIVERY */}

            <div className="rounded-xl border border-gray-200 bg-[#f8faff] p-5">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">
                  D
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Delivery
                  </p>

                  <p className="mt-2 font-semibold text-gray-900">
                    {order.delivery_address}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================
            PACKAGE + PAYMENT
        ====================================================== */}

        <div className="mt-6 grid gap-6 md:grid-cols-2">

          {/* PACKAGE */}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Package Information
            </h2>

            <div className="mt-6 divide-y divide-gray-100">

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Package Type
                </span>

                <span className="font-semibold text-gray-900">
                  {order.package_type}
                </span>
              </div>

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Weight
                </span>

                <span className="font-semibold text-gray-900">
                  {order.package_weight} kg
                </span>
              </div>

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Delivery Type
                </span>

                <span className="font-semibold capitalize text-gray-900">
                  {order.delivery_type}
                </span>
              </div>

            </div>
          </section>

          {/* PAYMENT */}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Payment Information
            </h2>

            <div className="mt-6 divide-y divide-gray-100">

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Payment Method
                </span>

                <span className="font-semibold uppercase text-gray-900">
                  {order.payment_method}
                </span>
              </div>

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Order Amount
                </span>

                <span className="font-semibold text-gray-900">
                  {formatCurrency(order.order_amount)}
                </span>
              </div>

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  Delivery Fee
                </span>

                <span className="font-semibold text-gray-900">
                  {formatCurrency(order.delivery_fee)}
                </span>
              </div>

              <div className="flex justify-between py-4">
                <span className="text-gray-500">
                  COD Surcharge
                </span>

                <span className="font-semibold text-gray-900">
                  {formatCurrency(order.cod_surcharge)}
                </span>
              </div>

              <div className="flex justify-between pt-5">
                <span className="text-lg font-bold text-gray-900">
                  Total
                </span>

                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

            </div>
          </section>

        </div>

        {/* ======================================================
            EXPECTED DELIVERY
        ====================================================== */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Expected Delivery
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Estimated delivery date for this order
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 px-5 py-3 font-bold text-blue-700">
              {formatDate(
                order.expected_delivery_date
              )}
            </div>

          </div>
        </section>

        {/* ======================================================
            TRACKING TIMELINE
        ====================================================== */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Tracking Timeline
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Complete delivery history
            </p>
          </div>

          {events.length === 0 ? (
            <div className="mt-6 rounded-xl bg-[#f8faff] px-6 py-12 text-center">
              <div className="text-4xl">
                📦
              </div>

              <p className="mt-4 font-semibold text-gray-700">
                No tracking events yet.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Update the order status above to start
                the delivery timeline.
              </p>
            </div>
          ) : (
            <div className="mt-8">

              {events.map((event, index) => {
                const normalizedStatus =
                  normalizeStatus(event.status);

                const isLast =
                  index === events.length - 1;

                return (
                  <div
                    key={event.id}
                    className="relative flex gap-4 pb-8"
                  >
                    {/* CONNECTING LINE */}

                    {!isLast && (
                      <div className="absolute left-[18px] top-10 h-[calc(100%-20px)] w-px bg-gray-300" />
                    )}

                    {/* NUMBER */}

                    <div
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                        isLast
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-green-200 bg-green-50 text-green-700"
                      }`}
                    >
                      {index + 1}
                    </div>

                    {/* EVENT CARD */}

                    <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-[#f8faff] p-5">

                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-900">
                              {getStatusLabel(
                                normalizedStatus
                              )}
                            </h3>

                            {isLast && (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                CURRENT STATUS
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-gray-600">
                            {event.description ||
                              STATUS_DESCRIPTIONS[
                                normalizedStatus
                              ] ||
                              "Tracking update"}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-medium text-gray-500">
                          {formatDateTime(
                            event.created_at
                          )}
                        </span>

                      </div>

                      {event.location && (
                        <p className="mt-4 text-sm text-gray-600">
                          📍 {event.location}
                        </p>
                      )}

                      {event.latitude !== null &&
                        event.latitude !== undefined &&
                        event.longitude !== null &&
                        event.longitude !== undefined && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            🛰️ GPS: {event.latitude.toFixed(6)},{" "}
                            {event.longitude.toFixed(6)}
                          </a>
                        )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </section>

        {/* ======================================================
            BOTTOM ACTIONS
        ====================================================== */}

        <div className="mt-8 flex flex-wrap gap-4 pb-10">

          <button
            onClick={() =>
              router.push(
                "/dashboard/agent/deliveries"
              )
            }
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
          >
            ← Back to Deliveries
          </button>

          <button
            onClick={() => {
              loadOrder();
              loadTracking();
            }}
            disabled={updating}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ↻ Refresh
          </button>

        </div>

      </div>
    </main>
  );
}