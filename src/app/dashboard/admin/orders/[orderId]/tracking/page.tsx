"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type TrackingEvent = {
  id: string;
  order_id: string;
  status: string;
  description: string | null;
  location: string | null;
  updated_by: string | null;
  created_at: string;
};

type TrackingResponse = {
  success: boolean;
  orderId?: string;
  currentStatus?: string;
  count?: number;
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

function formatStatus(status: string) {
  return status
    .split("_")
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusIndex(status: string) {
  return STATUS_FLOW.indexOf(
    status.trim().toLowerCase().replace(/\s+/g, "_") as
      (typeof STATUS_FLOW)[number]
  );
}

export default function AdminOrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTracking() {
    if (!orderId) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/orders/${orderId}/tracking`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data: TrackingResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load tracking information."
        );
      }

      setTracking(data);
    } catch (err) {
      console.error("Admin tracking error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tracking information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTracking();
  }, [orderId]);

  const currentStatus = (
    tracking?.currentStatus || "pending"
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const eventMap = useMemo(() => {
    const map = new Map<string, TrackingEvent>();

    for (const event of tracking?.events ?? []) {
      const normalized = event.status
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      map.set(normalized, event);
    }

    return map;
  }, [tracking?.events]);

  const currentStatusIndex = statusIndex(currentStatus);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/dashboard/admin/orders/${orderId}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              ← Back to Order Details
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Order Tracking
            </h1>

            <p className="mt-1 text-gray-600">
              Track the complete delivery history of this order.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTracking}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Tracking"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

            <p className="mt-4 text-gray-600">
              Loading tracking information...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold text-red-800">
              Unable to load tracking
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={loadTracking}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && tracking && (
          <>
            {/* Order Summary */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
                    Order Tracking
                  </p>

                  <h2 className="mt-2 break-all text-2xl font-bold text-gray-900">
                    {tracking.orderId}
                  </h2>

                  <p className="mt-2 text-sm text-gray-500">
                    {tracking.count ?? 0} tracking event
                    {(tracking.count ?? 0) === 1 ? "" : "s"} recorded
                  </p>
                </div>

                <div className="rounded-full bg-blue-50 px-5 py-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                    Current Status
                  </p>

                  <p className="mt-1 font-bold text-blue-700">
                    {formatStatus(currentStatus)}
                  </p>
                </div>
              </div>
            </section>

            {/* Timeline */}
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Delivery Timeline
                </h2>

                <p className="mt-1 text-gray-600">
                  Complete tracking history for this order.
                </p>
              </div>

              {/* Normal workflow */}
              <div className="space-y-0">
                {STATUS_FLOW.map((status, index) => {
                  const event = eventMap.get(status);

                  const completed = Boolean(event);

                  const isCurrent =
                    currentStatus === status;

                  const passed =
                    currentStatusIndex >= 0 &&
                    index < currentStatusIndex;

                  const isCompleted =
                    completed || passed;

                  const isLast =
                    index === STATUS_FLOW.length - 1;

                  return (
                    <div
                      key={status}
                      className="relative flex gap-5"
                    >
                      {/* Connector */}
                      {!isLast && (
                        <div
                          className={`absolute left-[15px] top-9 h-full w-0.5 ${
                            isCompleted
                              ? "bg-green-500"
                              : "bg-gray-200"
                          }`}
                        />
                      )}

                      {/* Status circle */}
                      <div className="relative z-10 flex-shrink-0">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                            isCompleted
                              ? "border-green-500 bg-green-500 text-white"
                              : isCurrent
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-gray-300 bg-white text-gray-400"
                          }`}
                        >
                          {isCompleted ? "✓" : index + 1}
                        </div>
                      </div>

                      {/* Event content */}
                      <div
                        className={`mb-8 flex-1 rounded-xl border p-5 ${
                          isCurrent
                            ? "border-blue-200 bg-blue-50"
                            : isCompleted
                            ? "border-green-200 bg-green-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {formatStatus(status)}
                            </h3>

                            {event ? (
                              <p className="mt-1 text-sm text-gray-600">
                                {event.description ||
                                  `Order status changed to ${formatStatus(
                                    status
                                  )}.`}
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-gray-500">
                                {isCurrent
                                  ? "Current delivery status."
                                  : "Waiting for this stage."}
                              </p>
                            )}
                          </div>

                          {event && (
                            <span className="whitespace-nowrap text-sm font-medium text-gray-500">
                              {formatDate(event.created_at)}
                            </span>
                          )}
                        </div>

                        {event?.location && (
                          <div className="mt-4 text-sm text-gray-600">
                            <span className="font-medium">
                              Location:
                            </span>{" "}
                            {event.location}
                          </div>
                        )}

                        {event?.updated_by && (
                          <div className="mt-2 text-xs text-gray-500">
                            Updated by: {event.updated_by}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Exception / administrative events */}
              {tracking.events &&
                tracking.events.some((event) => {
                  const status = event.status
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");

                  return !STATUS_FLOW.includes(
                    status as (typeof STATUS_FLOW)[number]
                  );
                }) && (
                  <div className="mt-4 border-t border-gray-200 pt-8">
                    <h3 className="text-lg font-bold text-gray-900">
                      Exception / Administrative Events
                    </h3>

                    <div className="mt-4 space-y-4">
                      {tracking.events
                        .filter((event) => {
                          const status = event.status
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, "_");

                          return !STATUS_FLOW.includes(
                            status as (typeof STATUS_FLOW)[number]
                          );
                        })
                        .map((event) => (
                          <div
                            key={event.id}
                            className="rounded-xl border border-orange-200 bg-orange-50 p-5"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {formatStatus(event.status)}
                                </h4>

                                <p className="mt-1 text-sm text-gray-600">
                                  {event.description ||
                                    `Order status changed to ${formatStatus(
                                      event.status
                                    )}.`}
                                </p>
                              </div>

                              <span className="whitespace-nowrap text-sm text-gray-500">
                                {formatDate(event.created_at)}
                              </span>
                            </div>

                            {event.location && (
                              <p className="mt-3 text-sm text-gray-600">
                                <span className="font-medium">
                                  Location:
                                </span>{" "}
                                {event.location}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Empty state */}
              {(!tracking.events ||
                tracking.events.length === 0) && (
                <div className="rounded-xl bg-gray-50 p-8 text-center">
                  <h3 className="font-semibold text-gray-800">
                    No tracking events yet
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    Tracking information will appear here once
                    the order starts moving.
                  </p>
                </div>
              )}
            </section>

            {/* Footer Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/dashboard/admin/orders/${orderId}`}
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                ← Back to Order Details
              </Link>

              <Link
                href="/dashboard/admin/orders"
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Back to Orders
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}