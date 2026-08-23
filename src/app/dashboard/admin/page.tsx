"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Order = Record<string, unknown>;


const DeliveryMap = dynamic(
  () => import("@/components/admin/DeliveryMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <span className="text-xs font-medium text-slate-500">
          Loading delivery map...
        </span>
      </div>
    ),
  }
);


function stringValue(order: Order, ...keys: string[]) {
  for (const key of keys) {
    const value = order[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "";
}

function numberValue(order: Order, ...keys: string[]) {
  for (const key of keys) {
    const value = order[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function normalizeStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
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

function getStatusClass(status: string) {
  switch (normalizeStatus(status)) {
    case "delivered":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "in_transit":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "out_for_delivery":
      return "bg-orange-50 text-orange-700 border-orange-200";

    case "assigned":
    case "picked_up":
      return "bg-violet-50 text-violet-700 border-violet-200";

    case "failed":
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";

    case "rescheduled":
      return "bg-amber-50 text-amber-700 border-amber-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/orders", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load orders."
        );
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.error("Admin dashboard order loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const statistics = useMemo(() => {
    const normalized = orders.map((order) =>
      normalizeStatus(
        stringValue(order, "status", "order_status")
      )
    );

    const activeStatuses = new Set([
      "assigned",
      "picked_up",
      "in_transit",
      "out_for_delivery",
    ]);

    const activeDeliveries = normalized.filter((status) =>
      activeStatuses.has(status)
    ).length;

    const delivered = normalized.filter(
      (status) => status === "delivered"
    ).length;

    const failed = normalized.filter(
      (status) => status === "failed"
    ).length;

    const rescheduled = normalized.filter(
      (status) => status === "rescheduled"
    ).length;

    const issues = failed + rescheduled;

    const completedOrTracked = orders.filter((order) => {
      const status = normalizeStatus(
        stringValue(order, "status", "order_status")
      );

      return (
        status === "delivered" ||
        status === "failed"
      );
    }).length;

    const onTimeRate =
      completedOrTracked > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((delivered / completedOrTracked) * 100)
            )
          )
        : 0;

    return {
      total: orders.length,
      activeDeliveries,
      delivered,
      failed,
      rescheduled,
      issues,
      onTimeRate,
    };
  }, [orders]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const first = new Date(
          stringValue(a, "created_at", "createdAt")
        ).getTime();

        const second = new Date(
          stringValue(b, "created_at", "createdAt")
        ).getTime();

        return second - first;
      })
      .slice(0, 6);
  }, [orders]);

  const agents = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        deliveries: number;
        active: number;
      }
    >();

    for (const order of orders) {
      const agentName = stringValue(
        order,
        "agent_name",
        "delivery_agent_name",
        "agent",
        "agent_id"
      );

      if (!agentName) {
        continue;
      }

      const status = normalizeStatus(
        stringValue(order, "status", "order_status")
      );

      const existing = map.get(agentName);

      if (existing) {
        existing.deliveries += 1;

        if (
          [
            "assigned",
            "picked_up",
            "in_transit",
            "out_for_delivery",
          ].includes(status)
        ) {
          existing.active += 1;
        }
      } else {
        map.set(agentName, {
          name: agentName,
          deliveries: 1,
          active: [
            "assigned",
            "picked_up",
            "in_transit",
            "out_for_delivery",
          ].includes(status)
            ? 1
            : 0,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 4);
  }, [orders]);

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        {/* ======================================================
            SIDEBAR
        ====================================================== */}
        <aside className="hidden w-[245px] shrink-0 border-r border-slate-200 bg-[#f8faff] lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                GL
              </div>

              <div>
                <div className="text-sm font-bold text-slate-900">
                  Global Logistics
                </div>
                <div className="text-[10px] font-medium text-slate-500">
                  Admin Terminal
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-5">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Operations
            </div>

            <Link
              href="/dashboard/admin"
              className="mb-1 flex items-center gap-3 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              <span>▦</span>
              Dashboard
            </Link>

            <Link
              href="/dashboard/admin/orders"
              className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>◫</span>
              Deliveries
            </Link>

            <Link
              href="/dashboard/agent/inventory"
              className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>▤</span>
              Inventory
            </Link>

            <button
              type="button"
              className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>◉</span>
              Fleet
            </button>

            <button
              type="button"
              className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>▥</span>
              Analytics
            </button>

            <button
              type="button"
              className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>♙</span>
              Users
            </button>

            <div className="mt-6">
              <Link
                href="/dashboard/customer/orders/create"
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <span>＋</span>
                Create New Order
              </Link>
            </div>
          </nav>

          <div className="border-t border-slate-200 px-4 py-4">
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              <span>?</span>
              Help
            </button>

            <Link
              href="/"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              <span>↪</span>
              Sign Out
            </Link>
          </div>
        </aside>

        {/* ======================================================
            MAIN CONTENT
        ====================================================== */}
        <section className="min-w-0 flex-1">
          {/* HEADER */}
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold tracking-tight text-slate-900">
                LogisticsPro
              </div>

              <div className="hidden h-9 w-[340px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 md:flex">
                <span className="text-slate-400">⌕</span>
                <input
                  type="text"
                  placeholder="Search orders, agents, locations..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                className="relative text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                notifications
                <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>

              <button
                type="button"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
              >
                settings
              </button>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                A
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1450px] px-5 py-7 md:px-8">
            {/* PAGE TITLE */}
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
                  Admin Terminal
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                  Overview
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Real-time delivery operations summary for today.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadOrders}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  ↻ Refresh
                </button>

                <Link
                  href="/dashboard/admin/orders"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  View Orders
                </Link>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* ==================================================
                KPI CARDS
            ================================================== */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Active Deliveries
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {loading ? "—" : statistics.activeDeliveries}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    ↗
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-emerald-600">
                  {statistics.total} total orders
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      On-Time Rate
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {loading
                        ? "—"
                        : `${statistics.onTimeRate.toFixed(1)}%`}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    ✓
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-slate-500">
                  Based on completed deliveries
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Issues Reported
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {loading ? "—" : statistics.issues}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    !
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-red-500">
                  {statistics.failed} failed · {statistics.rescheduled} rescheduled
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Delivered
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {loading ? "—" : statistics.delivered}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    ✓
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-slate-500">
                  Successfully completed
                </p>
              </div>
            </div>

            {/* ==================================================
                MAP + TOP AGENTS
            ================================================== */}
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
              {/* MAP */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Live Delivery Map
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Current operational delivery activity
                    </p>
                  </div>

                  <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
                    Live
                  </span>
                </div>

                <div className="relative h-[360px] overflow-hidden bg-slate-100">
                  <DeliveryMap orders={orders} />

                  <div className="pointer-events-none absolute left-4 top-4 z-[1000] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Logistics Operations
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-800">
                      Live delivery network
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm">
                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      Active delivery
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      Attention required
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm">
                    {orders.filter((order) => {
                      const latitude = Number(
                        order.delivery_latitude
                      );

                      const longitude = Number(
                        order.delivery_longitude
                      );

                      return (
                        Number.isFinite(latitude) &&
                        Number.isFinite(longitude)
                      );
                    }).length}{" "}
                    mapped
                  </div>
                </div>
              </div>

              {/* TOP AGENTS */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Top Agents
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Delivery activity
                    </p>
                  </div>

                  <span className="text-[10px] font-semibold text-blue-600">
                    View All
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {agents.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        ♙
                      </div>

                      <p className="mt-3 text-xs font-medium text-slate-600">
                        No agent assignments available
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Agents will appear when orders are assigned.
                      </p>
                    </div>
                  ) : (
                    agents.map((agent, index) => (
                      <div
                        key={agent.name}
                        className="flex items-center gap-3 px-5 py-4"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                          {agent.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {agent.name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {agent.deliveries} deliveries · {agent.active} active
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-600">
                            #{index + 1}
                          </div>

                          <div className="mt-0.5 text-[9px] text-slate-400">
                            rank
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 p-3">
                  <Link
                    href="/dashboard/admin/orders"
                    className="block rounded-lg bg-slate-50 py-2 text-center text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    View All Deliveries
                  </Link>
                </div>
              </div>
            </div>

            {/* ==================================================
                RECENT ORDERS
            ================================================== */}
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Recent Orders
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Latest customer orders and delivery status
                  </p>
                </div>

                <Link
                  href="/dashboard/admin/orders"
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Full Roster →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Order ID
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Destination
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Amount
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Created
                      </th>

                      <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-slate-400"
                        >
                          Loading live order data...
                        </td>
                      </tr>
                    ) : recentOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-slate-400"
                        >
                          No orders found.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order, index) => {
                        const id = stringValue(
                          order,
                          "id"
                        );

                        const orderNumber =
                          stringValue(
                            order,
                            "order_number",
                            "orderNumber"
                          ) || id.slice(0, 8);

                        const destination =
                          stringValue(
                            order,
                            "delivery_address",
                            "destination",
                            "delivery_location",
                            "dropoff_address"
                          ) || "—";

                        const status =
                          stringValue(
                            order,
                            "status",
                            "order_status"
                          ) || "pending";

                        const amount =
                          numberValue(
                            order,
                            "total_amount",
                            "total",
                            "order_amount",
                            "amount"
                          );

                        const createdAt =
                          stringValue(
                            order,
                            "created_at",
                            "createdAt"
                          );

                        return (
                          <tr
                            key={id || index}
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <div className="font-mono text-xs font-bold text-slate-800">
                                #{orderNumber}
                              </div>
                            </td>

                            <td className="max-w-[280px] px-5 py-4">
                              <div className="truncate text-xs text-slate-600">
                                {destination}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusClass(
                                  status
                                )}`}
                              >
                                {formatStatus(status)}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                              ₹
                              {amount.toLocaleString(
                                "en-IN",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </td>

                            <td className="px-5 py-4 text-xs text-slate-500">
                              {formatDate(createdAt)}
                            </td>

                            <td className="px-5 py-4 text-right">
                              {id ? (
                                <Link
                                  href={`/dashboard/admin/orders/${id}`}
                                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  View
                                </Link>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ==================================================
                FOOTER SUMMARY
            ================================================== */}
            <div className="mt-5 flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">
              <span>
                Last-Mile Delivery Tracker · Admin Terminal
              </span>

              <span>
                {statistics.total} orders loaded from Supabase
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
