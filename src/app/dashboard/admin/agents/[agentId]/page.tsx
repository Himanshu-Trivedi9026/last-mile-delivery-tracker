"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

type Agent = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  zone_id: string | null;
  zone_name?: string | null;
  is_available: boolean;

  current_latitude?: number | null;
  current_longitude?: number | null;

  assigned_order_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssignedOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  pickup_address: string;
  delivery_address: string;
  package_weight: number | null;
  package_type: string | null;
  delivery_type: string | null;
  payment_method: string | null;
  order_amount: number | null;
  delivery_fee: number | null;
  cod_surcharge: number | null;
  status: string;
  assigned_agent_id: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  updated_at: string;
  rescheduled_date: string | null;
  delivery_attempt: number | null;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "in_transit":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "out_for_delivery":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "assigned":
    case "picked_up":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "rescheduled":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "failed":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function formatCurrency(value?: number | null) {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function formatCoordinate(value?: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue.toFixed(6);
}

export default function AgentDetailsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");

  const [locationRefreshing, setLocationRefreshing] =
    useState(false);

  async function loadAgent(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const agentResponse = await fetch(
        "/api/admin/agents",
        {
          cache: "no-store",
        }
      );

      const agentData = await agentResponse.json();

      if (
        !agentResponse.ok ||
        !agentData.success
      ) {
        throw new Error(
          agentData.error ||
            "Failed to load delivery agent."
        );
      }

      const foundAgent = (
        agentData.agents ?? []
      ).find(
        (item: Agent) =>
          item.id === agentId
      );

      if (!foundAgent) {
        throw new Error(
          "Delivery agent not found."
        );
      }

      setAgent(foundAgent);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load delivery agent.";

      setError(message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function loadOrders(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setOrdersLoading(true);
      }

      setOrdersError("");

      const ordersResponse =
        await fetch(
          `/api/admin/agents/${agentId}/orders`,
          {
            cache: "no-store",
          }
        );

      const ordersData =
        await ordersResponse.json();

      if (
        !ordersResponse.ok ||
        !ordersData.success
      ) {
        throw new Error(
          ordersData.error ||
            "Failed to load assigned deliveries."
        );
      }

      setOrders(
        ordersData.orders ?? []
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load assigned deliveries.";

      setOrdersError(message);
    } finally {
      if (showLoading) {
        setOrdersLoading(false);
      }
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!mounted) {
        return;
      }

      setLoading(true);
      setOrdersLoading(true);

      await Promise.all([
        loadAgent(true),
        loadOrders(true),
      ]);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [agentId]);

  /*
   * Refresh agent information periodically so that
   * current_latitude/current_longitude are updated
   * on the Admin dashboard while the delivery agent
   * is sending GPS coordinates.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(async () => {
        setLocationRefreshing(true);

        try {
          await loadAgent(false);
        } finally {
          setLocationRefreshing(false);
        }
      }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [agentId]);

  // ==========================================================
  // DERIVED DELIVERY STATISTICS
  // ==========================================================

  const deliveredCount =
    orders.filter(
      (order) =>
        order.status === "delivered"
    ).length;

  const inTransitCount =
    orders.filter(
      (order) =>
        order.status === "in_transit" ||
        order.status === "out_for_delivery" ||
        order.status === "picked_up"
    ).length;

  const rescheduledCount =
    orders.filter(
      (order) =>
        order.status === "rescheduled"
    ).length;

  const failedCount =
    orders.filter(
      (order) =>
        order.status === "failed" ||
        order.status === "cancelled"
    ).length;

  const latitude =
    formatCoordinate(
      agent?.current_latitude
    );

  const longitude =
    formatCoordinate(
      agent?.current_longitude
    );

  const hasLocation =
    latitude !== null &&
    longitude !== null;

  const mapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${agent?.current_latitude},${agent?.current_longitude}`
    : null;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-sm font-semibold text-slate-500">
              Loading delivery agent...
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !agent) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-800">
              Unable to load delivery agent
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error ||
                "Delivery agent not found."}
            </p>

            <Link
              href="/dashboard/admin/agents"
              className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              ← Back to Delivery Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="mb-6">
          <Link
            href="/dashboard/admin/agents"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600"
          >
            ← Back to Delivery Agents
          </Link>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                  {agent.full_name}
                </h1>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    agent.is_available
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {agent.is_available
                    ? "Available"
                    : "Unavailable"}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Delivery Agent Details
              </p>
            </div>

            <Link
              href="/dashboard/admin/agents"
              className="inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              All Agents
            </Link>
          </div>
        </div>

        {/* ==================================================
            AGENT OVERVIEW
        ================================================== */}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          {/* Availability */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Availability
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  agent.is_available
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
              />

              <div className="text-xl font-black text-slate-950">
                {agent.is_available
                  ? "Available"
                  : "Unavailable"}
              </div>
            </div>
          </div>

          {/* Assigned */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assigned Deliveries
            </div>

            <div className="mt-3 text-3xl font-black text-slate-950">
              {ordersLoading
                ? "—"
                : orders.length}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Orders assigned to this agent
            </div>
          </div>

          {/* Delivered */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Delivered
            </div>

            <div className="mt-3 text-3xl font-black text-emerald-600">
              {ordersLoading
                ? "—"
                : deliveredCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Successfully completed
            </div>
          </div>

          {/* Active */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Deliveries
            </div>

            <div className="mt-3 text-3xl font-black text-blue-600">
              {ordersLoading
                ? "—"
                : inTransitCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Currently in progress
            </div>
          </div>
        </section>

        {/* ==================================================
            AGENT INFORMATION
        ================================================== */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Agent Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Basic account and operational details.
                </p>
              </div>

              {locationRefreshing && (
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                  Updating location...
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Full Name
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {agent.full_name}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Phone
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {agent.phone || "Not Available"}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Role
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {agent.role}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Zone
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {agent.zone_name ||
                  agent.zone_id ||
                  "Not Assigned"}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Agent ID
              </div>

              <div className="mt-2 break-all font-mono text-xs font-semibold text-slate-600">
                {agent.id}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Created
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {formatDateTime(
                  agent.created_at
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Last Updated
              </div>

              <div className="mt-2 text-sm font-bold text-slate-900">
                {formatDateTime(
                  agent.updated_at
                )}
              </div>
            </div>

            {/* ==================================================
                CURRENT LOCATION
            ================================================== */}

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Current Location
              </div>

              {hasLocation ? (
                <div className="mt-2">
                  <div className="text-sm font-black text-slate-900">
                    {latitude}, {longitude}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Live GPS coordinates
                  </div>

                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      Open in Maps →
                    </a>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  <div className="text-sm font-bold text-slate-500">
                    Location Not Available
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Waiting for agent GPS update.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================================================
            DELIVERY STATISTICS
        ================================================== */}

        <section className="mt-6 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Delivered
            </div>

            <div className="mt-2 text-2xl font-black text-emerald-800">
              {ordersLoading
                ? "—"
                : deliveredCount}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Rescheduled
            </div>

            <div className="mt-2 text-2xl font-black text-amber-800">
              {ordersLoading
                ? "—"
                : rescheduledCount}
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Failed / Cancelled
            </div>

            <div className="mt-2 text-2xl font-black text-red-800">
              {ordersLoading
                ? "—"
                : failedCount}
            </div>
          </div>
        </section>

        {/* ==================================================
            ASSIGNED DELIVERIES
        ================================================== */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Assigned Deliveries
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Orders currently assigned to this delivery agent.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                {orders.length} orders
              </div>
            </div>
          </div>

          {/* Error */}

          {ordersError && (
            <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {ordersError}
            </div>
          )}

          {/* Loading */}

          {ordersLoading ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-500">
                Loading assigned deliveries...
              </p>
            </div>
          ) : orders.length === 0 ? (
            /* Empty */

            <div className="p-12 text-center">
              <div className="text-3xl">
                📦
              </div>

              <div className="mt-3 text-base font-bold text-slate-900">
                No assigned deliveries
              </div>

              <p className="mt-1 text-sm text-slate-500">
                This agent currently has no assigned orders.
              </p>
            </div>
          ) : (
            /* Orders */

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">

                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Order
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Delivery
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Payment
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >

                      {/* Order */}

                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-950">
                          {order.order_number}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Created{" "}
                          {formatDate(
                            order.created_at
                          )}
                        </div>

                        {order.expected_delivery_date && (
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            Expected{" "}
                            {formatDate(
                              order.expected_delivery_date
                            )}
                          </div>
                        )}
                      </td>

                      {/* Delivery */}

                      <td className="max-w-[300px] px-6 py-5">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          From
                        </div>

                        <div className="mt-1 truncate text-sm font-semibold text-slate-700">
                          {order.pickup_address ||
                            "—"}
                        </div>

                        <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          To
                        </div>

                        <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                          {order.delivery_address ||
                            "—"}
                        </div>
                      </td>

                      {/* Status */}

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {formatStatus(
                            order.status
                          )}
                        </span>

                        {order.rescheduled_date && (
                          <div className="mt-2 text-xs font-medium text-amber-600">
                            New date:{" "}
                            {formatDate(
                              order.rescheduled_date
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment */}

                      <td className="px-6 py-5">
                        <div className="text-sm font-bold uppercase text-slate-800">
                          {order.payment_method ||
                            "—"}
                        </div>

                        {order.payment_method ===
                          "cod" && (
                          <div className="mt-1 text-xs text-slate-500">
                            COD{" "}
                            {formatCurrency(
                              order.cod_surcharge
                            )}
                          </div>
                        )}

                        {order.delivery_attempt ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Attempt{" "}
                            {order.delivery_attempt}
                          </div>
                        ) : null}
                      </td>

                      {/* Amount */}

                      <td className="px-6 py-5">
                        <div className="text-sm font-black text-slate-950">
                          {formatCurrency(
                            order.order_amount
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Delivery{" "}
                          {formatCurrency(
                            order.delivery_fee
                          )}
                        </div>

                        {order.payment_method ===
                          "cod" && (
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            Total{" "}
                            {formatCurrency(
                              Number(
                                order.order_amount ??
                                  0
                              ) +
                                Number(
                                  order.delivery_fee ??
                                    0
                                ) +
                                Number(
                                  order.cod_surcharge ??
                                    0
                                )
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action */}

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/dashboard/admin/orders/${order.id}`}
                          className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          View Order →
                        </Link>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}