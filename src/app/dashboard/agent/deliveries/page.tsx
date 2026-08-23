"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  order_number: string;
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
};

type OrdersResponse = {
  success: boolean;
  role?: string;
  count?: number;
  orders?: Order[];
  error?: string;
};

type AssignResponse = {
  success: boolean;
  message?: string;
  error?: string;
  order?: Order;
};

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

const STATUS_OPTIONS = [
  "all",
  "pending",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

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

function formatDate(date: string | null) {
  if (!date) {
    return "Not specified";
  }

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getStatusClasses(status: string) {
  switch (normalizeStatus(status)) {
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

    case "failed":
    case "cancelled":
      return "bg-red-100 text-red-700 border-red-200";

    default:
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }
}

export default function AgentDeliveriesPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [assigningOrderId, setAssigningOrderId] =
    useState<string | null>(null);

  // ============================================================
  // LOAD ORDERS
  // ============================================================

  const loadOrders = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response = await fetch("/api/orders", {
          method: "GET",
          cache: "no-store",
        });

        const data: OrdersResponse =
          await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Failed to load deliveries."
          );
        }

        setOrders(data.orders ?? []);
      } catch (err) {
        console.error("Load deliveries error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load deliveries."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ============================================================
  // ASSIGN ORDER TO CURRENT AGENT
  // ============================================================

  async function handleAssignOrder(orderId: string) {
    if (assigningOrderId) {
      return;
    }

    try {
      setAssigningOrderId(orderId);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `/api/orders/${orderId}/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data: AssignResponse =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to assign order."
        );
      }

      setSuccessMessage(
        data.message ||
          "Order assigned successfully."
      );

      // Refresh the order list so the new status
      // and assignment are immediately visible.
      await loadOrders(false);
    } catch (err) {
      console.error("Assign order error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign order."
      );
    } finally {
      setAssigningOrderId(null);
    }
  }

  // ============================================================
  // FILTER ORDERS
  // ============================================================

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const normalizedStatus =
        normalizeStatus(order.status);

      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        order.order_number
          .toLowerCase()
          .includes(query) ||
        order.pickup_address
          .toLowerCase()
          .includes(query) ||
        order.delivery_address
          .toLowerCase()
          .includes(query) ||
        order.package_type
          .toLowerCase()
          .includes(query)
      );
    });
  }, [orders, search, statusFilter]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const statistics = useMemo(() => {
    const pending = orders.filter(
      (order) =>
        normalizeStatus(order.status) === "pending"
    ).length;

    const assigned = orders.filter(
      (order) =>
        normalizeStatus(order.status) === "assigned"
    ).length;

    const active = orders.filter((order) =>
      [
        "picked_up",
        "in_transit",
        "out_for_delivery",
      ].includes(normalizeStatus(order.status))
    ).length;

    const delivered = orders.filter(
      (order) =>
        normalizeStatus(order.status) ===
        "delivered"
    ).length;

    return {
      total: orders.length,
      pending,
      assigned,
      active,
      delivered,
    };
  }, [orders]);

  // ============================================================
  // SIDEBAR NAVIGATION
  // ============================================================

  function handleNavigation(path: string) {
    router.push(path);
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc]">
        <div className="flex min-h-screen">

          <aside className="hidden w-64 border-r border-gray-200 bg-white p-6 md:block">
            <div className="h-8 w-36 animate-pulse rounded bg-gray-200" />

            <div className="mt-10 space-y-3">
              <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </aside>

          <section className="flex-1 p-6 md:p-10">
            <div className="mx-auto max-w-7xl">

              <div className="h-9 w-64 animate-pulse rounded bg-gray-200" />

              <div className="mt-8 grid gap-5 md:grid-cols-4">
                {Array.from({ length: 4 }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="h-28 animate-pulse rounded-2xl bg-white"
                    />
                  )
                )}
              </div>

              <div className="mt-8 h-20 animate-pulse rounded-2xl bg-white" />

              <div className="mt-6 space-y-4">
                {Array.from({ length: 3 }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="h-52 animate-pulse rounded-2xl bg-white"
                    />
                  )
                )}
              </div>

            </div>
          </section>
        </div>
      </main>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f9fc]">

      <div className="flex min-h-screen">

        {/* ======================================================
            SIDEBAR
        ====================================================== */}

        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white md:block">

          <div className="sticky top-0 flex h-screen flex-col p-5">

            {/* LOGO */}

            <button
              type="button"
              onClick={() =>
                handleNavigation(
                  "/dashboard/agent"
                )
              }
              className="flex items-center gap-3 rounded-xl px-2 py-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">
                🚚
              </div>

              <div>
                <p className="text-lg font-bold text-gray-900">
                  LogisticsPro
                </p>

                <p className="text-xs text-gray-500">
                  Agent Portal
                </p>
              </div>
            </button>

            {/* NAVIGATION */}

            <nav className="mt-8 space-y-2">

              <button
                type="button"
                onClick={() =>
                  handleNavigation(
                    "/dashboard/agent"
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-blue-600"
              >
                <span>▣</span>
                Dashboard
              </button>

              <button
                type="button"
                onClick={() =>
                  handleNavigation(
                    "/dashboard/agent/deliveries"
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700"
              >
                <span>▤</span>
                Deliveries
              </button>

            </nav>

            {/* BOTTOM */}

            <div className="mt-auto">

              <button
                type="button"
                onClick={() =>
                  handleNavigation("/")
                }
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-red-50 hover:text-red-600"
              >
                <span>↪</span>
                Logout
              </button>

            </div>

          </div>
        </aside>

        {/* ======================================================
            CONTENT
        ====================================================== */}

        <section className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">

          <div className="mx-auto max-w-7xl">

            {/* ==================================================
                HEADER
            ================================================== */}

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                  Agent Portal
                </p>

                <h1 className="mt-1 text-3xl font-bold text-gray-900">
                  Deliveries
                </h1>

                <p className="mt-2 text-sm text-gray-500">
                  Manage your delivery orders and
                  update their progress.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadOrders(false)}
                disabled={refreshing}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                >
                  ↻
                </span>

                {refreshing
                  ? "Refreshing..."
                  : "Refresh Orders"}
              </button>

            </div>

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">

                <div>
                  <p className="font-bold">
                    Something went wrong
                  </p>

                  <p className="mt-1">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setError("")}
                  className="font-bold text-red-500 hover:text-red-700"
                >
                  ×
                </button>

              </div>
            )}

            {/* ==================================================
                SUCCESS
            ================================================== */}

            {successMessage && (
              <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">

                <div>
                  <p className="font-bold">
                    Assignment successful
                  </p>

                  <p className="mt-1">
                    {successMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSuccessMessage("")
                  }
                  className="font-bold text-green-500 hover:text-green-700"
                >
                  ×
                </button>

              </div>
            )}

            {/* ==================================================
                STATISTICS
            ================================================== */}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Total Orders
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {statistics.total}
                </p>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-yellow-700">
                  Pending
                </p>

                <p className="mt-2 text-3xl font-bold text-yellow-800">
                  {statistics.pending}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-indigo-700">
                  Assigned
                </p>

                <p className="mt-2 text-3xl font-bold text-indigo-800">
                  {statistics.assigned}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-blue-700">
                  Active
                </p>

                <p className="mt-2 text-3xl font-bold text-blue-800">
                  {statistics.active}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-green-700">
                  Delivered
                </p>

                <p className="mt-2 text-3xl font-bold text-green-800">
                  {statistics.delivered}
                </p>
              </div>

            </div>

            {/* ==================================================
                SEARCH + FILTERS
            ================================================== */}

            <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                {/* SEARCH */}

                <div className="relative w-full lg:max-w-md">

                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search order number, address..."
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

                {/* FILTER */}

                <div className="flex flex-wrap gap-2">

                  {STATUS_OPTIONS.map(
                    (status) => {
                      const active =
                        statusFilter === status;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setStatusFilter(status)
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {status === "all"
                            ? "All"
                            : getStatusLabel(status)}
                        </button>
                      );
                    }
                  )}

                </div>

              </div>

            </section>

            {/* ==================================================
                RESULTS HEADER
            ================================================== */}

            <div className="mt-6 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Delivery Orders
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-semibold text-gray-700">
                    {filteredOrders.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-700">
                    {orders.length}
                  </span>{" "}
                  orders
                </p>
              </div>

            </div>

            {/* ==================================================
                EMPTY STATE
            ================================================== */}

            {filteredOrders.length === 0 ? (
              <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
                  📦
                </div>

                <h3 className="mt-5 text-xl font-bold text-gray-900">
                  No deliveries found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  {search ||
                  statusFilter !== "all"
                    ? "Try changing your search or filter."
                    : "There are currently no delivery orders available."}
                </p>

                {(search ||
                  statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Clear Filters
                  </button>
                )}

              </section>
            ) : (
              /* ==================================================
                 ORDER LIST
              ================================================== */

              <div className="mt-6 space-y-5">

                {filteredOrders.map(
                  (order) => {
                    const normalizedStatus =
                      normalizeStatus(
                        order.status
                      );

                    const isPending =
                      normalizedStatus ===
                      "pending";

                    const isAssigning =
                      assigningOrderId ===
                      order.id;

                    const isAssignedToSomeone =
                      Boolean(
                        order.assigned_agent_id
                      );

                    return (
                      <article
                        key={order.id}
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                      >

                        {/* CARD HEADER */}

                        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">

                          <div>
                            <div className="flex flex-wrap items-center gap-3">

                              <h3 className="text-lg font-bold text-gray-900">
                                {order.order_number}
                              </h3>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                  normalizedStatus
                                )}`}
                              >
                                {getStatusLabel(
                                  normalizedStatus
                                )}
                              </span>

                            </div>

                            <p className="mt-2 text-xs text-gray-500">
                              Created{" "}
                              {formatDate(
                                order.created_at
                              )}
                            </p>
                          </div>

                          <div className="text-left md:text-right">

                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Order Value
                            </p>

                            <p className="mt-1 text-lg font-bold text-gray-900">
                              {formatCurrency(
                                Number(
                                  order.order_amount ||
                                    0
                                ) +
                                  Number(
                                    order.delivery_fee ||
                                      0
                                  ) +
                                  Number(
                                    order.cod_surcharge ||
                                      0
                                  )
                              )}
                            </p>

                          </div>

                        </div>

                        {/* CARD BODY */}

                        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr_220px]">

                          {/* PICKUP */}

                          <div className="rounded-xl bg-blue-50 p-4">

                            <div className="flex items-start gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                                P
                              </div>

                              <div className="min-w-0">

                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                  Pickup
                                </p>

                                <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                                  {
                                    order.pickup_address
                                  }
                                </p>

                              </div>

                            </div>

                          </div>

                          {/* DELIVERY */}

                          <div className="rounded-xl bg-green-50 p-4">

                            <div className="flex items-start gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                                D
                              </div>

                              <div className="min-w-0">

                                <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                                  Delivery
                                </p>

                                <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                                  {
                                    order.delivery_address
                                  }
                                </p>

                              </div>

                            </div>

                          </div>

                          {/* PACKAGE */}

                          <div className="rounded-xl border border-gray-200 p-4">

                            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                              Package
                            </p>

                            <p className="mt-2 font-semibold text-gray-900">
                              {
                                order.package_type
                              }
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              {
                                order.package_weight
                              }{" "}
                              kg
                            </p>

                            <p className="mt-1 text-sm capitalize text-gray-500">
                              {
                                order.delivery_type
                              }{" "}
                              delivery
                            </p>

                          </div>

                        </div>

                        {/* ==================================================
                            ASSIGNMENT AREA
                        ================================================== */}

                        {isPending && (
                          <div className="border-t border-gray-100 bg-yellow-50/60 px-5 py-4">

                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                              <div>

                                <p className="font-bold text-gray-900">
                                  Order awaiting assignment
                                </p>

                                <p className="mt-1 text-sm text-gray-600">
                                  Claim this order to start
                                  the delivery workflow.
                                </p>

                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleAssignOrder(
                                    order.id
                                  )
                                }
                                disabled={
                                  Boolean(
                                    assigningOrderId
                                  ) ||
                                  isAssignedToSomeone
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isAssigning ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Assigning...
                                  </>
                                ) : (
                                  <>
                                    ✓ Assign to Me
                                  </>
                                )}
                              </button>

                            </div>

                          </div>
                        )}

                        {/* ==================================================
                            ASSIGNED INFO
                        ================================================== */}

                        {normalizedStatus ===
                          "assigned" &&
                          order.assigned_agent_id && (
                            <div className="border-t border-gray-100 bg-indigo-50/60 px-5 py-4">

                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                                <div>
                                  <p className="font-bold text-indigo-900">
                                    Order assigned
                                  </p>

                                  <p className="mt-1 text-sm text-indigo-700">
                                    This delivery is now
                                    assigned to a delivery
                                    agent.
                                  </p>
                                </div>

                                <span className="rounded-full border border-indigo-200 bg-indigo-100 px-4 py-2 text-xs font-bold text-indigo-700">
                                  ASSIGNED
                                </span>

                              </div>

                            </div>
                          )}

                        {/* ==================================================
                            CARD FOOTER
                        ================================================== */}

                        <div className="flex flex-col gap-4 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">

                            <span>
                              Payment:{" "}
                              <strong className="uppercase text-gray-700">
                                {
                                  order.payment_method
                                }
                              </strong>
                            </span>

                            <span>
                              Expected:{" "}
                              <strong className="text-gray-700">
                                {formatDate(
                                  order.expected_delivery_date
                                )}
                              </strong>
                            </span>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/dashboard/agent/deliveries/${order.id}`
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
                          >
                            View Order
                            <span>→</span>
                          </button>

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}