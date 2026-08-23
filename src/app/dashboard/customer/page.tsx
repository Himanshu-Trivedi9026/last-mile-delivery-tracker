"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

const ACTIVE_STATUSES = [
  "pending",
  "picked_up",
  "in_transit",
  "out_for_delivery",
];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toUpperCase();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
      return "bg-[#dae2fd] text-[#3f465c]";

    case "cancelled":
      return "bg-[#ffdad6] text-[#93000a]";

    case "in_transit":
    case "out_for_delivery":
    case "picked_up":
      return "bg-[#e1e0ff] text-[#2f2ebe]";

    case "pending":
    default:
      return "bg-[#d3e4fe] text-[#0b1c30]";
  }
}

export default function CustomerDashboard() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);

  const ORDERS_PER_PAGE = 5;

  // ============================================================
  // LOAD USER + ORDERS
  // ============================================================

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [ordersResponse, profileResponse] = await Promise.all([
          fetch("/api/orders", {
            method: "GET",
            cache: "no-store",
          }),

          fetch("/api/auth/me", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        const ordersData = await ordersResponse.json();
        const profileData = await profileResponse.json();

        if (!ordersResponse.ok || !ordersData.success) {
          if (ordersResponse.status === 401) {
            router.push("/");
            return;
          }

          throw new Error(
            ordersData.error || "Failed to load orders."
          );
        }

        if (
          profileResponse.ok &&
          profileData.success &&
          profileData.profile
        ) {
          setProfile(profileData.profile);
        }

        setOrders(ordersData.orders || []);
      } catch (err) {
        console.error("Dashboard loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  // ============================================================
  // METRICS
  // ============================================================

  const totalOrders = orders.length;

  const activeOrders = orders.filter((order) =>
    ACTIVE_STATUSES.includes(order.status.toLowerCase())
  ).length;

  const deliveredOrders = orders.filter(
    (order) => order.status.toLowerCase() === "delivered"
  ).length;

  const cancelledOrders = orders.filter(
    (order) => order.status.toLowerCase() === "cancelled"
  ).length;

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.pickup_address.toLowerCase().includes(query) ||
        order.delivery_address.toLowerCase().includes(query) ||
        order.package_type.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        order.status.toLowerCase() === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        order.delivery_type.toLowerCase() === typeFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        order.payment_method.toLowerCase() === paymentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesPayment
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    typeFilter,
    paymentFilter,
  ]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ORDERS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) * ORDERS_PER_PAGE;

  const visibleOrders = filteredOrders.slice(
    startIndex,
    startIndex + ORDERS_PER_PAGE
  );

  // ============================================================
  // RESET PAGE
  // ============================================================

  function resetPage() {
    setCurrentPage(1);
  }

  // ============================================================
  // SIGN OUT
  // ============================================================

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  // ============================================================
  // CREATE ORDER
  // ============================================================

  function handleCreateOrder() {
  router.push("/dashboard/customer/orders/create");
}

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f9ff] flex items-center justify-center text-[#0b1c30]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#d3e4fe] border-t-[#0058be]" />

          <p className="text-sm text-[#45464d]">
            Loading your orders...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="min-h-screen w-full bg-[#f8f9ff] text-[#0b1c30] antialiased">

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-[260px] flex-col border-r border-[#c6c6cd] bg-[#eff4ff]">

        {/* Logo */}
        <div className="border-b border-[#c6c6cd] px-6 pb-4 pt-6">

          <div className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2170e4] text-white">
              <span className="text-sm">
                GL
              </span>
            </div>

            <span className="text-[20px] font-black">
              Global Logistics
            </span>

          </div>

          <span className="mt-1 block text-xs text-[#45464d]">
            Customer Terminal
          </span>

        </div>

        {/* Create Order */}
        <div className="px-4 py-4">

          <button
            onClick={handleCreateOrder}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#0058be] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            <span className="text-base">
              +
            </span>

            Create New Order
          </button>

        </div>

        {/* Navigation */}
        <nav className="flex-1">

          <button
            onClick={() =>
              router.push("/dashboard/customer")
            }
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] transition hover:bg-[#e5eeff]"
          >
            <span className="text-lg">
              ▦
            </span>

            Dashboard
          </button>

          <button
            className="flex w-full items-center gap-4 border-r-4 border-[#0058be] bg-[#dce9ff] px-6 py-3 text-left font-semibold text-[#0058be]"
          >
            <span className="text-lg">
              🚚
            </span>

            Deliveries
          </button>

          <button
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] transition hover:bg-[#e5eeff]"
          >
            <span className="text-lg">
              ▣
            </span>

            Inventory
          </button>

          <button
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] transition hover:bg-[#e5eeff]"
          >
            <span className="text-lg">
              🚐
            </span>

            Fleet
          </button>

          <button
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] transition hover:bg-[#e5eeff]"
          >
            <span className="text-lg">
              ▥
            </span>

            Analytics
          </button>

          <button
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] transition hover:bg-[#e5eeff]"
          >
            <span className="text-lg">
              👥
            </span>

            Users
          </button>

        </nav>

        {/* Bottom */}
        <div className="border-t border-[#c6c6cd] py-2">

          <button className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#45464d] hover:bg-[#e5eeff]">
            <span>
              ?
            </span>

            Support
          </button>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-4 px-6 py-3 text-left text-[#ba1a1a] hover:bg-[#ffdad6]"
          >
            <span>
              ↪
            </span>

            Sign Out
          </button>

        </div>

      </aside>

      {/* ======================================================
          MAIN AREA
      ====================================================== */}

      <div className="md:ml-[260px] min-w-0">

        {/* ====================================================
            TOP NAV
        ==================================================== */}

        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#c6c6cd] bg-[#f8f9ff] px-6">

          <div className="flex flex-1 items-center gap-4">

            <div className="hidden md:flex w-64 items-center rounded border border-[#c6c6cd] bg-[#eff4ff] px-3 py-2 focus-within:border-[#0058be]">

              <span className="mr-2 text-sm text-[#45464d]">
                🔍
              </span>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search orders..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#45464d]"
              />

            </div>

          </div>

          <div className="flex items-center gap-3">

            <button className="rounded-full p-2 text-[#45464d] hover:bg-[#eff4ff]">
              🔔
            </button>

            <button className="rounded-full p-2 text-[#45464d] hover:bg-[#eff4ff]">
              ⚙
            </button>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
              {profile?.full_name?.charAt(0).toUpperCase() || "U"}
            </div>

          </div>

        </header>

        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}

        <main className="bg-[#f8f9ff] p-4 md:p-6">

          <div className="mx-auto max-w-[1440px]">

            {/* Page Heading */}
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">

              <div>

                <h1 className="text-[24px] font-semibold tracking-tight">
                  My Orders
                </h1>

                <p className="mt-1 text-sm text-[#45464d]">
                  View and manage all your delivery orders.
                </p>

                {profile?.full_name && (
                  <p className="mt-1 text-xs text-[#45464d]">
                    Welcome, {profile.full_name}
                  </p>
                )}

              </div>

              <button
                onClick={handleCreateOrder}
                className="flex items-center justify-center gap-2 rounded bg-black px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#213145]"
              >
                <span>
                  +
                </span>

                Create New Order
              </button>

            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm text-[#93000a]">
                {error}
              </div>
            )}

            {/* =================================================
                SUMMARY CARDS
            ================================================= */}

            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

              <MetricCard
                title="Total Orders"
                value={totalOrders}
                icon="🛒"
              />

              <MetricCard
                title="Active Orders"
                value={activeOrders}
                icon="📦"
                highlighted
              />

              <MetricCard
                title="Delivered"
                value={deliveredOrders}
                icon="✓"
              />

              <MetricCard
                title="Cancelled"
                value={cancelledOrders}
                icon="×"
                danger
              />

            </div>

            {/* =================================================
                FILTER TOOLBAR
            ================================================= */}

            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-[#c6c6cd] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">

              {/* Search */}
              <div className="flex flex-1 items-center rounded border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 focus-within:border-[#0058be]">

                <span className="mr-2 text-sm text-[#45464d]">
                  🔍
                </span>

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPage();
                  }}
                  placeholder="Search order #, address..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#45464d]"
                />

              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    resetPage();
                  }}
                  className="rounded border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 text-sm outline-none focus:border-[#0058be]"
                >
                  <option value="all">
                    Status: All
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  <option value="picked_up">
                    Picked Up
                  </option>

                  <option value="in_transit">
                    In Transit
                  </option>

                  <option value="out_for_delivery">
                    Out for Delivery
                  </option>

                  <option value="delivered">
                    Delivered
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value);
                    resetPage();
                  }}
                  className="rounded border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 text-sm outline-none focus:border-[#0058be]"
                >
                  <option value="all">
                    Type: All
                  </option>

                  <option value="standard">
                    Standard
                  </option>

                  <option value="express">
                    Express
                  </option>

                  <option value="freight">
                    Freight
                  </option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(event) => {
                    setPaymentFilter(event.target.value);
                    resetPage();
                  }}
                  className="rounded border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 text-sm outline-none focus:border-[#0058be]"
                >
                  <option value="all">
                    Payment: All
                  </option>

                  <option value="cod">
                    COD
                  </option>

                  <option value="card">
                    Card
                  </option>

                  <option value="invoice">
                    Invoice
                  </option>
                </select>

                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setPaymentFilter("all");
                    resetPage();
                  }}
                  className="rounded border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 text-sm hover:bg-[#eff4ff]"
                >
                  Reset
                </button>

              </div>

            </div>

            {/* =================================================
                TABLE
            ================================================= */}

            <div className="overflow-hidden rounded-lg border border-[#c6c6cd] bg-white">

              <div className="overflow-x-auto">

                <table className="w-full border-collapse text-left">

                  <thead>

                    <tr className="border-b border-[#c6c6cd] bg-[#eff4ff]">

                      <TableHeader>
                        Order #
                      </TableHeader>

                      <TableHeader>
                        Pickup
                      </TableHeader>

                      <TableHeader>
                        Delivery
                      </TableHeader>

                      <TableHeader>
                        Package
                      </TableHeader>

                      <TableHeader>
                        Type
                      </TableHeader>

                      <TableHeader>
                        Payment
                      </TableHeader>

                      <TableHeader align="right">
                        Amount
                      </TableHeader>

                      <TableHeader>
                        Status
                      </TableHeader>

                      <TableHeader>
                        Created
                      </TableHeader>

                      <TableHeader align="center">
                        Action
                      </TableHeader>

                    </tr>

                  </thead>

                  <tbody>

                    {visibleOrders.length === 0 ? (

                      <tr>

                        <td
                          colSpan={10}
                          className="px-6 py-16 text-center"
                        >

                          <div className="text-4xl">
                            📦
                          </div>

                          <h3 className="mt-3 font-semibold">
                            No orders found
                          </h3>

                          <p className="mt-1 text-sm text-[#45464d]">
                            Try changing your search or filters.
                          </p>

                        </td>

                      </tr>

                    ) : (

                      visibleOrders.map((order) => (

                        <tr
                          key={order.id}
                          className="border-b border-[#c6c6cd] transition hover:bg-[#f8f9ff]"
                        >

                          <td className="whitespace-nowrap px-3 py-3 text-xs font-bold">
                            {order.order_number}
                          </td>

                          <td className="min-w-[170px] px-3 py-3">

                            <div className="flex flex-col">

                              <span className="text-sm">
                                {order.pickup_address}
                              </span>

                            </div>

                          </td>

                          <td className="min-w-[170px] px-3 py-3">

                            <div className="flex flex-col">

                              <span className="text-sm">
                                {order.delivery_address}
                              </span>

                            </div>

                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-sm">

                            {order.package_type}

                            <div className="text-[10px] text-[#45464d]">
                              {order.package_weight} kg
                            </div>

                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-sm capitalize">
                            {order.delivery_type}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-sm uppercase">
                            {order.payment_method}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-bold">
                            {formatCurrency(order.order_amount)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3">

                            <span
                              className={`inline-flex rounded px-2 py-1 text-[10px] font-bold tracking-wide ${getStatusClass(
                                order.status
                              )}`}
                            >
                              {formatStatus(order.status)}
                            </span>

                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-[#45464d]">
                            {formatDate(order.created_at)}
                          </td>

                          <td className="px-3 py-3 text-center">

                            <button
                              onClick={() =>
                                router.push(
                                  `/dashboard/customer/orders/${order.id}`
                                )
                              }
                              className="text-xs font-bold text-[#0058be] hover:text-[#0b1c30]"
                            >
                              View
                            </button>

                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

              {/* =================================================
                  PAGINATION
              ================================================= */}

              <div className="flex items-center justify-between border-t border-[#c6c6cd] bg-[#eff4ff] px-3 py-3">

                <span className="text-xs text-[#45464d]">

                  Showing{" "}

                  {filteredOrders.length === 0
                    ? 0
                    : startIndex + 1}{" "}

                  to{" "}

                  {Math.min(
                    startIndex + ORDERS_PER_PAGE,
                    filteredOrders.length
                  )}{" "}

                  of {filteredOrders.length} entries

                </span>

                <div className="flex items-center gap-1">

                  <button
                    disabled={safeCurrentPage <= 1}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1)
                      )
                    }
                    className="rounded border border-[#c6c6cd] bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ←
                  </button>

                  <span className="px-2 text-xs">
                    {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    disabled={
                      safeCurrentPage >= totalPages
                    }
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                      )
                    }
                    className="rounded border border-[#c6c6cd] bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    →
                  </button>

                </div>

              </div>

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function MetricCard({
  title,
  value,
  icon,
  highlighted = false,
  danger = false,
}: {
  title: string;
  value: number;
  icon: string;
  highlighted?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 transition ${
        highlighted
          ? "border-[#0058be]"
          : "border-[#c6c6cd]"
      }`}
    >

      <div className="mb-3 flex items-start justify-between">

        <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
          {title}
        </span>

        <span
          className={`text-lg ${
            danger
              ? "text-[#ba1a1a]"
              : highlighted
              ? "text-[#0058be]"
              : "text-[#45464d]"
          }`}
        >
          {icon}
        </span>

      </div>

      <span className="text-4xl font-bold tracking-tight">
        {value}
      </span>

    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#45464d] ${
        align === "right"
          ? "text-right"
          : align === "center"
          ? "text-center"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}