"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type TrackingEvent = {
  id: string;
  order_id: string;
  status: string;
  description: string | null;
  location: string | null;
  updated_by: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string;
  pickup_address: string;
  delivery_address: string;
  package_type: string;
  package_weight: number;
  delivery_type: string;
  payment_method: string;
  order_amount: number;
  delivery_fee: number;
  cod_surcharge: number;
  status: string;
  expected_delivery_date: string | null;
  created_at: string;
};

const STATUS_STEPS = [
  "pending",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatStatus(status: string) {
  return (
    STATUS_LABELS[status.toLowerCase()] ||
    status.replaceAll("_", " ")
  );
}

function formatDateTime(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusIndex(status: string) {
  const normalized = status.toLowerCase();

  const index = STATUS_STEPS.indexOf(normalized);

  return index;
}

function getEventStatusClass(
  status: string,
  isCurrent: boolean
) {
  const normalized = status.toLowerCase();

  if (isCurrent) {
    return "bg-[#0058be] text-white border-[#0058be]";
  }

  if (normalized === "cancelled") {
    return "bg-[#ffdad6] text-[#93000a] border-[#ffb4ab]";
  }

  return "bg-[#dff7ec] text-[#0f6b4d] border-[#a9e5cd]";
}

export default function TrackingPage() {
  const router = useRouter();

  const params = useParams();

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // LOAD ORDER + TRACKING
  // ============================================================

  useEffect(() => {
    if (!orderId) {
      setError("Order ID is missing.");
      setLoading(false);
      return;
    }

    async function loadTracking() {
      try {
        setLoading(true);
        setError("");

        // ------------------------------------------
        // Load order details
        // ------------------------------------------

        const orderResponse = await fetch(
          `/api/orders/${orderId}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const orderData = await orderResponse.json();

        if (!orderResponse.ok || !orderData.success) {
          if (orderResponse.status === 401) {
            router.push("/");
            return;
          }

          throw new Error(
            orderData.error || "Unable to load order."
          );
        }

        // ------------------------------------------
        // Load tracking events
        // ------------------------------------------

        const trackingResponse = await fetch(
          `/api/orders/${orderId}/tracking`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const trackingData =
          await trackingResponse.json();

        if (
          !trackingResponse.ok ||
          !trackingData.success
        ) {
          throw new Error(
            trackingData.error ||
              "Unable to load tracking history."
          );
        }

        setOrder(orderData.order);
        setEvents(trackingData.events || []);
      } catch (err) {
        console.error(
          "Tracking page loading error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tracking information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadTracking();
  }, [orderId, router]);

  // ============================================================
  // CURRENT STATUS
  // ============================================================

  const currentStatus = order?.status?.toLowerCase() || "";

  const currentStatusIndex =
    getStatusIndex(currentStatus);

  // ============================================================
  // TRACKING EVENT MAP
  // ============================================================

  const eventMap = useMemo(() => {
    const map: Record<string, TrackingEvent> = {};

    for (const event of events) {
      map[event.status.toLowerCase()] = event;
    }

    return map;
  }, [events]);

  // ============================================================
  // PROGRESS
  // ============================================================

  const progressPercentage =
    currentStatus === "cancelled"
      ? 0
      : currentStatusIndex <= 0
      ? 0
      : Math.round(
          (currentStatusIndex /
            (STATUS_STEPS.length - 1)) *
            100
        );

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">

        <div className="text-center">

          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#d3e4fe] border-t-[#0058be]" />

          <p className="text-sm text-[#45464d]">
            Loading tracking information...
          </p>

        </div>

      </main>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error || !order) {
    return (
      <main className="min-h-screen bg-[#f8f9ff] px-4 py-10">

        <div className="mx-auto max-w-5xl">

          <button
            onClick={() =>
              router.push(
                "/dashboard/customer"
              )
            }
            className="mb-6 text-sm font-semibold text-[#0058be] hover:underline"
          >
            ← Back to My Orders
          </button>

          <div className="rounded-xl border border-[#ffb4ab] bg-white p-8">

            <h1 className="text-2xl font-bold text-[#93000a]">
              Unable to Load Tracking
            </h1>

            <p className="mt-2 text-[#45464d]">
              {error || "Order could not be loaded."}
            </p>

          </div>

        </div>

      </main>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">

        {/* ====================================================
            BACK
        ==================================================== */}

        <button
          onClick={() =>
            router.push(
              `/dashboard/customer/orders/${order.id}`
            )
          }
          className="mb-6 text-sm font-semibold text-[#0058be] hover:underline"
        >
          ← Back to Order Details
        </button>

        {/* ====================================================
            HEADER
        ==================================================== */}

        <section className="mb-6 rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-[#0058be]">
                Live Delivery Tracking
              </p>

              <h1 className="mt-2 text-2xl font-bold md:text-3xl">
                {order.order_number}
              </h1>

              <p className="mt-2 text-sm text-[#45464d]">
                Track the current location and delivery
                progress of your order.
              </p>

            </div>

            <div
              className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold ${
                currentStatus === "delivered"
                  ? "bg-[#dff7ec] text-[#0f6b4d]"
                  : currentStatus === "cancelled"
                  ? "bg-[#ffdad6] text-[#93000a]"
                  : "bg-[#d3e4fe] text-[#0058be]"
              }`}
            >
              {formatStatus(currentStatus)}
            </div>

          </div>

        </section>

        {/* ====================================================
            ROUTE SUMMARY
        ==================================================== */}

        <section className="mb-6 rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

          <div className="mb-5">

            <h2 className="text-xl font-bold">
              Delivery Route
            </h2>

            <p className="mt-1 text-sm text-[#45464d]">
              Pickup and delivery locations
            </p>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* Pickup */}

            <div className="rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] p-5">

              <div className="flex items-start gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d3e4fe] font-bold text-[#0058be]">
                  P
                </div>

                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-[#45464d]">
                    Pickup
                  </p>

                  <p className="mt-1 font-semibold">
                    {order.pickup_address}
                  </p>

                </div>

              </div>

            </div>

            {/* Delivery */}

            <div className="rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] p-5">

              <div className="flex items-start gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dff7ec] font-bold text-[#0f6b4d]">
                  D
                </div>

                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-[#45464d]">
                    Delivery
                  </p>

                  <p className="mt-1 font-semibold">
                    {order.delivery_address}
                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* ====================================================
            PROGRESS
        ==================================================== */}

        <section className="mb-6 rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

          <div className="mb-5 flex items-center justify-between">

            <div>

              <h2 className="text-xl font-bold">
                Delivery Progress
              </h2>

              <p className="mt-1 text-sm text-[#45464d]">
                Current progress of your shipment
              </p>

            </div>

            <span className="text-lg font-bold text-[#0058be]">
              {progressPercentage}%
            </span>

          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#e5e7ef]">

            <div
              className="h-full rounded-full bg-[#0058be] transition-all duration-700"
              style={{
                width: `${progressPercentage}%`,
              }}
            />

          </div>

          <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[#45464d]">

            <span>
              Order Placed
            </span>

            <span>
              In Transit
            </span>

            <span>
              Delivered
            </span>

          </div>

        </section>

        {/* ====================================================
            TRACKING TIMELINE
        ==================================================== */}

        <section className="mb-6 rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

          <div className="mb-8">

            <h2 className="text-xl font-bold">
              Tracking Timeline
            </h2>

            <p className="mt-1 text-sm text-[#45464d]">
              Complete delivery history
            </p>

          </div>

          {events.length === 0 ? (

            <div className="rounded-lg border border-dashed border-[#c6c6cd] bg-[#f8f9ff] p-10 text-center">

              <div className="text-4xl">
                📦
              </div>

              <h3 className="mt-3 font-semibold">
                No tracking events yet
              </h3>

              <p className="mt-1 text-sm text-[#45464d]">
                Tracking information will appear here
                when the delivery process begins.
              </p>

            </div>

          ) : (

            <div className="relative">

              {events.map(
                (event, index) => {

                  const isCurrent =
                    index === events.length - 1;

                  const statusClass =
                    getEventStatusClass(
                      event.status,
                      isCurrent
                    );

                  return (
                    <div
                      key={event.id}
                      className="relative flex gap-5 pb-10 last:pb-0"
                    >

                      {/* Vertical line */}

                      {index <
                        events.length - 1 && (
                        <div className="absolute left-[19px] top-10 h-[calc(100%-10px)] w-[2px] bg-[#c6c6cd]" />
                      )}

                      {/* Number / icon */}

                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${statusClass}`}
                      >
                        {index + 1}
                      </div>

                      {/* Event content */}

                      <div className="flex-1 rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] p-4">

                        <div className="flex flex-col justify-between gap-2 md:flex-row">

                          <div>

                            <h3 className="text-base font-bold">
                              {formatStatus(
                                event.status
                              )}
                            </h3>

                            {event.description && (
                              <p className="mt-1 text-sm text-[#45464d]">
                                {event.description}
                              </p>
                            )}

                          </div>

                          <span className="text-xs text-[#45464d]">
                            {formatDateTime(
                              event.created_at
                            )}
                          </span>

                        </div>

                        {event.location && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-[#45464d]">
                            <span>
                              📍
                            </span>

                            <span>
                              {event.location}
                            </span>
                          </div>
                        )}

                        {isCurrent && (
                          <div className="mt-3 inline-flex rounded-full bg-[#d3e4fe] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0058be]">
                            Current Status
                          </div>
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* ====================================================
            ORDER INFORMATION
        ==================================================== */}

        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Package */}

          <div className="rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-xl font-bold">
              Package Information
            </h2>

            <div className="space-y-4">

              <InfoRow
                label="Package Type"
                value={order.package_type}
              />

              <InfoRow
                label="Weight"
                value={`${order.package_weight} kg`}
              />

              <InfoRow
                label="Delivery Type"
                value={order.delivery_type}
              />

            </div>

          </div>

          {/* Payment */}

          <div className="rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

            <h2 className="mb-5 text-xl font-bold">
              Payment Information
            </h2>

            <div className="space-y-4">

              <InfoRow
                label="Payment Method"
                value={order.payment_method}
              />

              <InfoRow
                label="Order Amount"
                value={`₹${order.order_amount.toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits: 2,
                  }
                )}`}
              />

              <InfoRow
                label="Delivery Fee"
                value={`₹${order.delivery_fee.toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits: 2,
                  }
                )}`}
              />

              <InfoRow
                label="COD Surcharge"
                value={`₹${order.cod_surcharge.toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits: 2,
                  }
                )}`}
              />

            </div>

          </div>

        </section>

        {/* ====================================================
            EXPECTED DELIVERY
        ==================================================== */}

        <section className="mb-6 rounded-xl border border-[#c6c6cd] bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

            <div>

              <h2 className="text-xl font-bold">
                Expected Delivery
              </h2>

              <p className="mt-1 text-sm text-[#45464d]">
                Estimated delivery date for this order
              </p>

            </div>

            <div className="rounded-lg bg-[#eff4ff] px-5 py-3 text-center">

              <p className="text-sm font-bold text-[#0058be]">

                {order.expected_delivery_date
                  ? new Date(
                      order.expected_delivery_date
                    ).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "Not specified"}

              </p>

            </div>

          </div>

        </section>

        {/* ====================================================
            ACTIONS
        ==================================================== */}

        <div className="flex flex-col gap-3 sm:flex-row">

          <button
            onClick={() =>
              router.push(
                `/dashboard/customer/orders/${order.id}`
              )
            }
            className="rounded-lg border border-[#c6c6cd] bg-white px-6 py-3 text-sm font-bold hover:bg-[#eff4ff]"
          >
            ← Order Details
          </button>

          <button
            onClick={() =>
              router.push(
                "/dashboard/customer"
              )
            }
            className="rounded-lg bg-[#0058be] px-6 py-3 text-sm font-bold text-white hover:bg-[#004a9f]"
          >
            Back to My Orders
          </button>

        </div>

      </main>

    </div>
  );
}

// ============================================================
// INFO ROW
// ============================================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#e5e5eb] pb-3 last:border-b-0">

      <span className="text-sm text-[#45464d]">
        {label}
      </span>

      <span className="text-sm font-bold text-right capitalize">
        {value}
      </span>

    </div>
  );
}