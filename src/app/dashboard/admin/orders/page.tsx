"use client";

import { useEffect, useMemo, useState } from "react";
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

type OrdersResponse = {
  success: boolean;
  role?: string;
  count?: number;
  orders?: Order[];
  error?: string;
};

const statusOptions: Array<{
  value: "all" | OrderStatus;
  label: string;
}> = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "assigned", label: "Assigned" },
  { value: "picked_up", label: "Picked Up" },
  { value: "in_transit", label: "In Transit" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" },
];

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
  }).format(value);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | OrderStatus
  >("all");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/orders", {
        method: "GET",
        cache: "no-store",
      });

      const data: OrdersResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load orders."
        );
      }

      setOrders(data.orders ?? []);
    } catch (err) {
      console.error("Admin orders error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load orders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

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
        order.customer_id
          .toLowerCase()
          .includes(query) ||
        order.pickup_address
          .toLowerCase()
          .includes(query) ||
        order.delivery_address
          .toLowerCase()
          .includes(query) ||
        (order.assigned_agent_id ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [orders, search, statusFilter]);

  const statistics = useMemo(() => {
    return {
      total: orders.length,

      pending: orders.filter(
        (order) => order.status === "pending"
      ).length,

      assigned: orders.filter(
        (order) => order.status === "assigned"
      ).length,

      inTransit: orders.filter(
        (order) => order.status === "in_transit"
      ).length,

      outForDelivery: orders.filter(
        (order) => order.status === "out_for_delivery"
      ).length,

      delivered: orders.filter(
        (order) => order.status === "delivered"
      ).length,

      failed: orders.filter(
        (order) => order.status === "failed"
      ).length,
    };
  }, [orders]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/dashboard/admin"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                ← Admin Dashboard
              </Link>
            </div>

            <h1 className="text-3xl font-bold text-gray-900">
              Order Management
            </h1>

            <p className="mt-2 text-gray-600">
              View and manage all customer orders.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Orders"}
          </button>
        </div>

        {/* Statistics */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Orders
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {statistics.total}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {statistics.pending}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Active Deliveries
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {statistics.assigned +
                statistics.inTransit +
                statistics.outForDelivery}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Delivered
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {statistics.delivered}
            </p>
          </div>

        </div>

        {/* Additional status summary */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">
              Assigned
            </p>

            <p className="mt-1 text-2xl font-bold text-purple-600">
              {statistics.assigned}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">
              In Transit
            </p>

            <p className="mt-1 text-2xl font-bold text-cyan-600">
              {statistics.inTransit}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">
              Out for Delivery
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-600">
              {statistics.outForDelivery}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">
              Failed
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {statistics.failed}
            </p>
          </div>

        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">

            <div>
              <label
                htmlFor="order-search"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Search Orders
              </label>

              <input
                id="order-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by order number, customer ID, address or agent ID..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "all"
                      | OrderStatus
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {statusOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Failed to load orders
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={loadOrders}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

            <p className="mt-4 text-sm text-gray-600">
              Loading orders...
            </p>
          </div>
        )}

        {/* Orders */}
        {!loading && !error && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">

            <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Orders
                </h2>

                <p className="text-sm text-gray-500">
                  Showing {filteredOrders.length} of{" "}
                  {orders.length} orders
                </p>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-lg font-semibold text-gray-900">
                  No orders found
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Try changing your search or status filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="min-w-[1200px] w-full">

                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Order
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Route
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Package
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Payment
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Agent
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Created
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="transition hover:bg-gray-50"
                      >

                        {/* Order */}
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-gray-900">
                            {order.order_number}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Customer ID:
                          </p>

                          <p className="max-w-[180px] truncate text-xs text-gray-600">
                            {order.customer_id}
                          </p>
                        </td>

                        {/* Route */}
                        <td className="max-w-[260px] px-5 py-4 align-top">

                          <p className="text-xs font-semibold text-gray-500">
                            Pickup
                          </p>

                          <p className="mt-1 text-sm text-gray-800">
                            {order.pickup_address}
                          </p>

                          <p className="mt-3 text-xs font-semibold text-gray-500">
                            Delivery
                          </p>

                          <p className="mt-1 text-sm text-gray-800">
                            {order.delivery_address}
                          </p>

                        </td>

                        {/* Package */}
                        <td className="px-5 py-4 align-top">

                          <p className="font-medium text-gray-900">
                            {order.package_type}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {order.package_weight} kg
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Chargeable:{" "}
                            {order.chargeable_weight ??
                              "—"}{" "}
                            kg
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {order.order_type ?? "—"} ·{" "}
                            {order.delivery_type}
                          </p>

                        </td>

                        {/* Payment */}
                        <td className="px-5 py-4 align-top">

                          <p className="font-semibold text-gray-900">
                            {formatCurrency(
                              Number(order.order_amount) +
                                Number(order.delivery_fee) +
                                Number(order.cod_surcharge)
                            )}
                          </p>

                          <p className="mt-1 text-xs uppercase text-gray-500">
                            {order.payment_method}
                          </p>

                          <p className="mt-2 text-xs text-gray-500">
                            Delivery:{" "}
                            {formatCurrency(
                              order.delivery_fee
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            COD:{" "}
                            {formatCurrency(
                              order.cod_surcharge
                            )}
                          </p>

                        </td>

                        {/* Agent */}
                        <td className="px-5 py-4 align-top">

                          {order.assigned_agent_id ? (
                            <>
                              <p className="text-sm font-medium text-gray-900">
                                Assigned
                              </p>

                              <p className="mt-1 max-w-[170px] truncate text-xs text-gray-500">
                                {order.assigned_agent_id}
                              </p>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">
                              Unassigned
                            </span>
                          )}

                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 align-top">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              order.status
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>

                          {order.status === "failed" &&
                            order.failure_reason && (
                              <p className="mt-2 max-w-[180px] text-xs text-red-600">
                                {order.failure_reason}
                              </p>
                            )}

                        </td>

                        {/* Created */}
                        <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-gray-600">

                          {formatDateTime(
                            order.created_at
                          )}

                          {order.expected_delivery_date && (
                            <p className="mt-2 text-xs text-gray-500">
                              Expected:{" "}
                              {formatDate(
                                order.expected_delivery_date
                              )}
                            </p>
                          )}

                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right align-top">

                          <Link
                            href={`/dashboard/admin/orders/${order.id}`}
                            className="inline-flex rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                          >
                            View
                          </Link>

                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}