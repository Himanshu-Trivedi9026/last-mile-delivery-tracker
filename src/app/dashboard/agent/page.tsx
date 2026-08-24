"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";


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

type OrdersResponse = {
  success: boolean;
  role?: string;
  count?: number;
  orders?: Order[];
  error?: string;
};

type MeResponse = {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  };
  error?: string;
};

type TrackingStatus =
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

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isDelivered(status: string) {
  return ["delivered", "completed"].includes(status.toLowerCase());
}

function isCancelled(status: string) {
  return ["cancelled", "canceled", "failed"].includes(
    status.toLowerCase()
  );
}

function isOutForDelivery(status: string) {
  return ["out_for_delivery", "out-for-delivery"].includes(
    status.toLowerCase()
  );
}

function isActive(status: string) {
  return !isDelivered(status) && !isCancelled(status);
}

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/*
 * Agent-facing delivery flow.
 *
 * We intentionally do not allow an agent to move an order
 * backward in the normal delivery lifecycle.
 */
const agentStatusFlow: TrackingStatus[] = [
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

function getNextStatuses(
  currentStatus: string
): TrackingStatus[] {
  const normalized = currentStatus.toLowerCase() as TrackingStatus;

  const currentIndex = agentStatusFlow.indexOf(normalized);

  if (currentIndex === -1) {
    return [];
  }

  return agentStatusFlow.slice(currentIndex + 1);
}

function getStatusDescription(status: string) {
  switch (status) {
    case "assigned":
      return "Order assigned to delivery agent.";

    case "picked_up":
      return "Package picked up from the customer.";

    case "in_transit":
      return "Package is currently in transit.";

    case "out_for_delivery":
      return "Package is out for delivery.";

    case "delivered":
      return "Package delivered successfully.";

    case "failed":
      return "Delivery attempt failed.";

    default:
      return "Delivery status updated.";
  }
}

function getStatusLocation(
  order: Order,
  status: string
) {
  switch (status) {
    case "picked_up":
      return order.pickup_address;

    case "out_for_delivery":
    case "delivered":
      return order.delivery_address;

    case "in_transit":
      return "Bhopal";

    case "failed":
      return order.delivery_address;

    default:
      return "Bhopal";
  }
}

function Icon({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function SvgIcon({
  type,
  size = 20,
}: {
  type:
    | "dashboard"
    | "truck"
    | "package"
    | "fleet"
    | "analytics"
    | "users"
    | "help"
    | "logout"
    | "bell"
    | "settings"
    | "search"
    | "location"
    | "person"
    | "map"
    | "warning"
    | "check"
    | "route"
    | "plus"
    | "minus"
    | "target";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );

    case "truck":
      return (
        <svg {...common}>
          <path d="M3 6h11v10H3z" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );

    case "package":
      return (
        <svg {...common}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "fleet":
      return (
        <svg {...common}>
          <path d="M5 17h14l1-6-2-5H6L4 11z" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );

    case "analytics":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20V7" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M18 14c2 .7 3 2.5 3 5" />
        </svg>
      );

    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-.9 1-1.9 1.3-1.9 2.9" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 4H5v16h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M18 12H9" />
        </svg>
      );

    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.2A1.7 1.7 0 0 0 7.8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.6V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
      );

    case "location":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "person":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );

    case "map":
      return (
        <svg {...common}>
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
          <path d="M9 3v15" />
          <path d="M15 6v15" />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );

    case "route":
      return (
        <svg {...common}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18c6 0 1-12 8-12" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );

    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}


async function updateAgentLocation() {
  try {
    const gps = await getCurrentGPSPosition();

    if (!gps) {
      return;
    }

    const response = await fetch(
      "/api/agent/location",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn(
        "Agent location update failed:",
        data.error || "Unknown error"
      );
    }
  } catch (error) {
    console.warn(
      "Agent location update error:",
      error
    );
  }
}

export default function AgentDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] =
    useState<MeResponse["profile"]>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  /*
   * Status update state
   */
  const [selectedStatus, setSelectedStatus] =
    useState<TrackingStatus | "">("");

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [statusError, setStatusError] =
    useState("");

  /*
   * Load dashboard
   */

  // ============================================================
  // AUTOMATIC AGENT GPS LOCATION SYNC
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function syncLocation() {
      if (!mounted) {
        return;
      }

      await updateAgentLocation();
    }

    // Send the current location immediately.
    syncLocation();

    // Keep the agent's GPS location fresh.
    const intervalId = window.setInterval(
      syncLocation,
      30_000
    );

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [meResponse, ordersResponse] =
          await Promise.all([
            fetch("/api/auth/me", {
              credentials: "include",
              cache: "no-store",
            }),

            fetch("/api/orders", {
              credentials: "include",
              cache: "no-store",
            }),
          ]);

        const meData: MeResponse =
          await meResponse.json();

        const ordersData: OrdersResponse =
          await ordersResponse.json();

        if (!meResponse.ok || !meData.success) {
          throw new Error(
            meData.error || "Unable to load user."
          );
        }

        if (
          !ordersResponse.ok ||
          !ordersData.success
        ) {
          throw new Error(
            ordersData.error ||
              "Unable to load delivery orders."
          );
        }

        if (
          meData.profile?.role !== "delivery_agent"
        ) {
          throw new Error(
            "This dashboard is only available to delivery agents."
          );
        }

        setProfile(meData.profile);
        setOrders(ordersData.orders ?? []);
      } catch (err) {
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
  }, []);

  /*
   * Active orders
   */
  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        isActive(order.status)
      ),
    [orders]
  );

  /*
   * Out for delivery count
   */
  const outForDeliveryCount = useMemo(
    () =>
      orders.filter((order) =>
        isOutForDelivery(order.status)
      ).length,
    [orders]
  );

  /*
   * Delivered today
   */
  const deliveredTodayCount = useMemo(() => {
    const today = new Date().toDateString();

    return orders.filter(
      (order) =>
        isDelivered(order.status) &&
        new Date(
          order.updated_at
        ).toDateString() === today
    ).length;
  }, [orders]);

  /*
   * Current active delivery
   */
  const currentOrder =
    activeOrders[0] ?? null;

  /*
   * Search
   */
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return orders;

    return orders.filter((order) =>
      [
        order.order_number,
        order.delivery_address,
        order.pickup_address,
        order.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [orders, search]);

  /*
   * When current order changes, reset selected status.
   */
  useEffect(() => {
    setSelectedStatus("");
    setStatusMessage("");
    setStatusError("");
  }, [currentOrder?.id]);

  /*
   * Logout
   */
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  }

  /*
   * Update delivery status
   */
  async function updateDeliveryStatus(
    order: Order,
    newStatus: TrackingStatus
  ) {
    try {
      setUpdatingOrderId(order.id);
      setStatusMessage("");
      setStatusError("");

      // Capture the agent's current GPS position at the moment
      // the delivery status is updated. If location permission is
      // denied/unavailable, the status update still proceeds.
      const gps = await getCurrentGPSPosition();

      const response = await fetch(
        `/api/orders/${order.id}/tracking`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            description:
              getStatusDescription(newStatus),
            location:
              getStatusLocation(
                order,
                newStatus
              ),
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to update delivery status."
        );
      }

      /*
       * Update local order immediately.
       */
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: newStatus,
                updated_at:
                  new Date().toISOString(),
              }
            : item
        )
      );

      setSelectedStatus("");

      setStatusMessage(
        `Order ${order.order_number} updated to ${formatStatus(
          newStatus
        )}.`
      );

      window.setTimeout(() => {
        setStatusMessage("");
      }, 4000);
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : "Unable to update delivery status."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  /*
   * Mark delivery exception / failed delivery.
   */
  async function markException(
    order: Order
  ) {
    const confirmed = window.confirm(
      `Mark order ${order.order_number} as a failed delivery attempt?`
    );

    if (!confirmed) {
      return;
    }

    await updateDeliveryStatus(
      order,
      "failed"
    );
  }

  /*
   * Open Google Maps.
   */
  function openMapNavigation(
    order: Order
  ) {
    const destination =
      encodeURIComponent(
        order.delivery_address
      );

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${destination}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /*
   * Loading state
   */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] text-[#0b1c30]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#dce9ff] border-t-[#0058be]" />

          <p className="text-sm text-[#45464d]">
            Loading delivery dashboard...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Error state
   */
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#c6c6cd] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#ffdad6] text-[#ba1a1a]">
            <SvgIcon
              type="warning"
              size={24}
            />
          </div>

          <h1 className="text-xl font-semibold text-[#0b1c30]">
            Unable to load dashboard
          </h1>

          <p className="mt-2 text-sm text-[#45464d]">
            {error}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[#c6c6cd] bg-white px-5 py-2.5 text-sm font-semibold text-[#0b1c30] hover:bg-[#eff4ff]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Main dashboard
   */
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">

      {/* =====================================================
          DESKTOP TOP BAR
      ====================================================== */}
      <header className="fixed left-0 right-0 top-0 z-40 hidden h-16 border-b border-[#c6c6cd] bg-white md:flex">
        <div className="ml-[260px] flex flex-1 items-center justify-between px-6">

          <div className="relative w-full max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d]">
              <SvgIcon
                type="search"
                size={18}
              />
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tracking ID, location, or status..."
              className="w-full rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be]"
            />
          </div>

          <div className="ml-6 flex items-center gap-3">

            <button
              type="button"
              className="relative rounded-full p-2.5 hover:bg-[#eff4ff]"
            >
              <SvgIcon
                type="bell"
                size={21}
              />

              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#0058be]" />
            </button>

            <button
              type="button"
              className="rounded-full p-2.5 hover:bg-[#eff4ff]"
            >
              <SvgIcon
                type="settings"
                size={21}
              />
            </button>

            <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
              {(profile?.full_name?.[0] ||
                "A"
              ).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          SIDEBAR
      ====================================================== */}
      <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-[260px] flex-col border-r border-[#c6c6cd] bg-[#eff4ff] md:flex">

        <div className="flex items-center gap-3 border-b border-[#c6c6cd] px-6 py-5">

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
            <SvgIcon
              type="truck"
              size={22}
            />
          </div>

          <div>
            <div className="text-sm font-black leading-tight">
              Global Logistics
            </div>

            <div className="mt-1 text-xs text-[#45464d]">
              Agent Terminal
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">

  <a
    href="/dashboard/agent"
    className="flex items-center gap-3 rounded-lg border-r-4 border-[#0058be] bg-[#dce9ff] px-4 py-3 font-semibold text-[#0058be]"
  >
    <SvgIcon
      type="dashboard"
      size={19}
    />
    Dashboard
  </a>

  <a
    href="/dashboard/agent/deliveries"
    className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#45464d] transition hover:bg-[#dce9ff] hover:text-[#0b1c30]"
  >
    <SvgIcon
      type="truck"
      size={19}
    />
    Deliveries
  </a>

  <Link
  href="/dashboard/agent/inventory"
  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#45464d] transition hover:bg-[#dce9ff]"
>
  <SvgIcon
    type="package"
    size={19}
  />
  Inventory
</Link>

  <button
    type="button"
    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#45464d] transition hover:bg-[#dce9ff]"
  >
    <SvgIcon
      type="fleet"
      size={19}
    />
    Fleet
  </button>

  <button
    type="button"
    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#45464d] transition hover:bg-[#dce9ff]"
  >
    <SvgIcon
      type="analytics"
      size={19}
    />
    Analytics
  </button>

  <button
    type="button"
    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#45464d] transition hover:bg-[#dce9ff]"
  >
    <SvgIcon
      type="users"
      size={19}
    />
    Users
  </button>

</nav>

        <div className="px-3 pb-4">

          <button
            type="button"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <SvgIcon
              type="plus"
              size={18}
            />
            Create New Order
          </button>

          <div className="border-t border-[#c6c6cd] pt-3">

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-[#45464d] hover:bg-[#dce9ff]"
            >
              <SvgIcon
                type="help"
                size={19}
              />
              Support
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]"
            >
              <SvgIcon
                type="logout"
                size={19}
              />
              Sign Out
            </button>

          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ====================================================== */}
      <main className="pt-0 md:ml-[260px] md:pt-16">

        <div className="p-4 md:p-6 lg:p-8">

          {/* Header */}
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">

            <div>

              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[#0058be]">
                Delivery Operations
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                Dashboard
              </h1>

              <p className="mt-1 text-base text-[#45464d]">
                Welcome back,{" "}
                {profile?.full_name ||
                  "Agent"}
                . Here is your overview for
                today.
              </p>

            </div>

            <div className="flex items-center gap-2">

              <span className="flex items-center gap-2 rounded border border-[#c6c6cd] bg-[#eff4ff] px-3 py-2 font-mono text-xs text-[#45464d]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#0058be]" />
                LIVE SYNC
              </span>

              <span className="rounded border border-[#c6c6cd] bg-[#eff4ff] px-3 py-2 font-mono text-xs text-[#45464d]">
                {new Date()
                  .toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  )
                  .toUpperCase()}
              </span>

            </div>
          </div>

          {/* =================================================
              MAIN GRID
          ================================================== */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">

            {/* =================================================
                LEFT COLUMN
            ================================================== */}
            <div className="flex flex-col gap-6 xl:col-span-8">

              {/* =================================================
                  CURRENT DELIVERY
              ================================================== */}
              <section className="relative overflow-hidden rounded-xl border border-[#c6c6cd] bg-white p-5 md:p-6">

                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#d3e4fe] opacity-50 blur-3xl" />

                <div className="relative z-10 mb-5 flex items-start justify-between border-b border-[#c6c6cd] pb-4">

                  <div>

                    <span className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#0058be]">
                      Current Active Delivery
                    </span>

                    <h2 className="text-xl font-semibold">
                      {currentOrder
                        ? currentOrder.order_number
                        : "No active delivery"}
                    </h2>

                  </div>

                  {currentOrder && (
                    <span className="flex items-center gap-1.5 rounded bg-[#2170e4] px-3 py-1.5 font-mono text-xs font-medium text-white">
                      {formatStatus(
                        currentOrder.status
                      )}
                    </span>
                  )}

                </div>

                {currentOrder ? (
                  <>

                    {/* Delivery information */}
                    <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2">

                      <div className="space-y-5">

                        {/* Destination */}
                        <div className="flex items-start gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c6c6cd] bg-[#eff4ff]">
                            <SvgIcon
                              type="location"
                              size={20}
                            />
                          </div>

                          <div className="min-w-0">

                            <span className="block text-xs text-[#45464d]">
                              Destination
                            </span>

                            <span className="mt-1 block text-base font-medium">
                              {
                                currentOrder.delivery_address
                              }
                            </span>

                          </div>
                        </div>

                        {/* Customer */}
                        <div className="flex items-start gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c6c6cd] bg-[#eff4ff]">
                            <SvgIcon
                              type="person"
                              size={20}
                            />
                          </div>

                          <div>

                            <span className="block text-xs text-[#45464d]">
                              Customer
                            </span>

                            <span className="mt-1 block text-sm font-medium">
                              Customer ID
                            </span>

                            <span className="mt-0.5 block font-mono text-xs text-[#0058be]">
                              {currentOrder.customer_id.slice(
                                0,
                                12
                              )}
                              ...
                            </span>

                          </div>
                        </div>

                      </div>

                      {/* Progress */}
                      <div className="flex flex-col justify-center rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] p-4">

                        <div className="mb-3 flex items-center justify-between">

                          <span className="text-xs text-[#45464d]">
                            Expected Delivery
                          </span>

                          <span className="text-sm font-semibold">
                            {formatDate(
                              currentOrder.expected_delivery_date
                            )}
                          </span>

                        </div>

                        <div className="mb-2 h-2 overflow-hidden rounded-full bg-[#d3e4fe]">

                          <div
                            className="h-full rounded-full bg-[#0058be] transition-all duration-500"
                            style={{
                              width:
                                isDelivered(
                                  currentOrder.status
                                )
                                  ? "100%"
                                  : isOutForDelivery(
                                        currentOrder.status
                                      )
                                  ? "80%"
                                  : currentOrder.status.toLowerCase() ===
                                      "in_transit"
                                  ? "65%"
                                  : currentOrder.status.toLowerCase() ===
                                      "picked_up"
                                  ? "50%"
                                  : "35%",
                            }}
                          />

                        </div>

                        <div className="flex justify-between text-xs text-[#45464d]">
                          <span>Assigned</span>
                          <span>In Transit</span>
                          <span>Delivered</span>
                        </div>

                      </div>
                    </div>

                    {/* =================================================
                        STATUS UPDATE PANEL
                    ================================================== */}
                    {!isDelivered(
                      currentOrder.status
                    ) &&
                      !isCancelled(
                        currentOrder.status
                      ) && (
                        <div className="relative z-10 mt-6 rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] p-4">

                          <div className="mb-4">

                            <div className="text-sm font-semibold">
                              Update Delivery Status
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              Current status:{" "}
                              <span className="font-semibold text-[#0058be]">
                                {formatStatus(
                                  currentOrder.status
                                )}
                              </span>
                            </div>

                          </div>

                          {/* Success */}
                          {statusMessage && (
                            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                              {statusMessage}
                            </div>
                          )}

                          {/* Error */}
                          {statusError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                              {statusError}
                            </div>
                          )}

                          <div className="flex flex-col gap-3 sm:flex-row">

                            <select
                              value={
                                selectedStatus
                              }
                              onChange={(event) => {
                                setSelectedStatus(
                                  event.target
                                    .value as
                                    | TrackingStatus
                                    | ""
                                );
                                setStatusError(
                                  ""
                                );
                                setStatusMessage(
                                  ""
                                );
                              }}
                              disabled={
                                updatingOrderId ===
                                currentOrder.id
                              }
                              className="flex-1 rounded-lg border border-[#c6c6cd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] disabled:cursor-not-allowed disabled:bg-[#eff4ff]"
                            >

                              <option value="">
                                Select next status
                              </option>

                              {getNextStatuses(
                                currentOrder.status
                              ).map(
                                (status) => (
                                  <option
                                    key={
                                      status
                                    }
                                    value={
                                      status
                                    }
                                  >
                                    {formatStatus(
                                      status
                                    )}
                                  </option>
                                )
                              )}

                            </select>

                            <button
                              type="button"
                              disabled={
                                !selectedStatus ||
                                updatingOrderId ===
                                  currentOrder.id
                              }
                              onClick={() => {
                                if (
                                  !selectedStatus
                                ) {
                                  setStatusError(
                                    "Please select a delivery status."
                                  );
                                  return;
                                }

                                updateDeliveryStatus(
                                  currentOrder,
                                  selectedStatus
                                );
                              }}
                              className="rounded-lg bg-[#0058be] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#004a9f] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updatingOrderId ===
                              currentOrder.id
                                ? "Updating..."
                                : "Update Status"}
                            </button>

                          </div>

                          <p className="mt-3 text-xs text-[#45464d]">
                            Status updates are recorded
                            in the delivery tracking
                            history and synchronized
                            with the order.
                          </p>

                        </div>
                      )}

                    {/* =================================================
                        ACTION BUTTONS
                    ================================================== */}
                    <div className="relative z-10 mt-4 flex flex-col gap-3 sm:flex-row">

                      <button
                        type="button"
                        onClick={() =>
                          openMapNavigation(
                            currentOrder
                          )
                        }
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        <SvgIcon
                          type="map"
                          size={18}
                        />
                        Open Map Navigation
                      </button>

                      {!isDelivered(
                        currentOrder.status
                      ) &&
                        !isCancelled(
                          currentOrder.status
                        ) && (
                          <button
                            type="button"
                            disabled={
                              updatingOrderId ===
                              currentOrder.id
                            }
                            onClick={() =>
                              markException(
                                currentOrder
                              )
                            }
                            className="flex items-center justify-center gap-2 rounded-lg border border-[#c6c6cd] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-[#eff4ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <SvgIcon
                              type="warning"
                              size={17}
                            />
                            Mark Exception
                          </button>
                        )}

                    </div>

                  </>
                ) : (

                  <div className="py-12 text-center">

                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eff4ff]">
                      <SvgIcon
                        type="package"
                        size={24}
                      />
                    </div>

                    <p className="font-semibold">
                      No active deliveries
                    </p>

                    <p className="mt-1 text-sm text-[#45464d]">
                      You currently have no active
                      orders assigned.
                    </p>

                  </div>

                )}
              </section>

              {/* =================================================
                  METRICS
              ================================================== */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

                {[
                  {
                    label: "Assigned Orders",
                    value: orders.length,
                    icon: "package" as const,
                  },
                  {
                    label: "Active Deliveries",
                    value:
                      activeOrders.length,
                    icon: "truck" as const,
                    active: true,
                  },
                  {
                    label: "Out for Delivery",
                    value:
                      outForDeliveryCount,
                    icon: "route" as const,
                  },
                  {
                    label: "Delivered Today",
                    value:
                      deliveredTodayCount,
                    icon: "check" as const,
                  },
                ].map((metric) => (

                  <div
                    key={metric.label}
                    className={`relative overflow-hidden rounded-xl border bg-white p-4 ${
                      metric.active
                        ? "border-[#0058be]"
                        : "border-[#c6c6cd]"
                    }`}
                  >

                    <div className="mb-3 text-[#45464d]">
                      <SvgIcon
                        type={metric.icon}
                        size={22}
                      />
                    </div>

                    <div className="text-xs text-[#45464d]">
                      {metric.label}
                    </div>

                    <div
                      className={`mt-1 text-3xl font-bold ${
                        metric.active
                          ? "text-[#0058be]"
                          : ""
                      }`}
                    >
                      {metric.value}
                    </div>

                  </div>

                ))}

              </div>

              {/* =================================================
                  ASSIGNED ORDERS
              ================================================== */}
              <section className="rounded-xl border border-[#c6c6cd] bg-white">

                <div className="flex items-center justify-between border-b border-[#c6c6cd] px-5 py-4">

                  <div>

                    <h2 className="font-semibold">
                      Assigned Orders
                    </h2>

                    <p className="mt-1 text-xs text-[#45464d]">
                      Live data from your
                      Supabase-backed orders API
                    </p>

                  </div>

                  <span className="rounded bg-[#eff4ff] px-2.5 py-1 font-mono text-xs">
                    {filteredOrders.length} ORDERS
                  </span>

                </div>

                {filteredOrders.length ===
                0 ? (

                  <div className="p-8 text-center text-sm text-[#45464d]">
                    No orders found.
                  </div>

                ) : (

                  <div className="divide-y divide-[#c6c6cd]">

                    {filteredOrders.map(
                      (order) => (

                        <div
                          key={order.id}
                          className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_2fr_1fr_1fr]"
                        >

                          <div>

                            <div className="font-mono text-xs font-bold">
                              {
                                order.order_number
                              }
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              {formatStatus(
                                order.status
                              )}
                            </div>

                          </div>

                          <div className="text-sm">

                            <div className="font-medium">
                              {
                                order.delivery_address
                              }
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              From:{" "}
                              {
                                order.pickup_address
                              }
                            </div>

                          </div>

                          <div>

                            <div className="text-xs text-[#45464d]">
                              Package
                            </div>

                            <div className="mt-1 text-sm font-medium">
                              {
                                order.package_type
                              }
                            </div>

                          </div>

                          <div className="md:text-right">

                            <div className="text-xs text-[#45464d]">
                              Amount
                            </div>

                            <div className="mt-1 text-sm font-semibold">
                              {formatCurrency(
                                order.order_amount
                              )}
                            </div>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

            </div>

            {/* =================================================
                RIGHT COLUMN
            ================================================== */}
            <div className="flex flex-col gap-6 xl:col-span-4">

              {/* =================================================
                  LIVE ROUTING
              ================================================== */}
              <section className="flex min-h-[430px] flex-col overflow-hidden rounded-xl border border-[#c6c6cd] bg-white">

                <div className="flex items-center justify-between border-b border-[#c6c6cd] px-4 py-3">

                  <span className="font-semibold">
                    Live Routing
                  </span>

                  <button
                    type="button"
                    className="rounded p-2 hover:bg-[#eff4ff]"
                  >
                    <SvgIcon
                      type="settings"
                      size={18}
                    />
                  </button>

                </div>

                <div className="relative flex-1 overflow-hidden bg-[#dce9ff]">

                  {/* Map-like background */}
                  <div className="absolute inset-0 opacity-50">

                    <div className="absolute left-[10%] top-[25%] h-px w-[80%] rotate-12 bg-white" />

                    <div className="absolute left-[5%] top-[45%] h-px w-[90%] -rotate-6 bg-white" />

                    <div className="absolute left-[20%] top-[65%] h-px w-[70%] rotate-3 bg-white" />

                    <div className="absolute left-[30%] top-[5%] h-[90%] w-px rotate-[20deg] bg-white" />

                    <div className="absolute left-[65%] top-[5%] h-[90%] w-px -rotate-[15deg] bg-white" />

                  </div>

                  {/* Route */}
                  <svg className="absolute inset-0 h-full w-full">

                    <path
                      d="M 60 330 Q 140 240 220 280 T 390 110"
                      fill="none"
                      stroke="#0058be"
                      strokeDasharray="7 7"
                      strokeWidth="4"
                    />

                  </svg>

                  {/* Current marker */}
                  <div className="absolute left-[56%] top-[42%] -translate-x-1/2 -translate-y-1/2">

                    <div className="mb-2 whitespace-nowrap rounded bg-black px-3 py-1.5 font-mono text-[10px] text-white shadow">
                      {currentOrder?.order_number ||
                        "NO ACTIVE ORDER"}
                    </div>

                    <div className="mx-auto h-4 w-4 rounded-full border-2 border-white bg-[#0058be] shadow-[0_0_0_5px_rgba(0,88,190,0.18)]" />

                  </div>

                  {/* Destination */}
                  {currentOrder && (
                    <div className="absolute bottom-6 right-5 max-w-[180px] rounded-lg border border-[#c6c6cd] bg-white p-3 shadow-sm">

                      <div className="flex gap-2">

                        <div className="mt-0.5 text-[#0058be]">
                          <SvgIcon
                            type="location"
                            size={16}
                          />
                        </div>

                        <div>

                          <div className="text-xs font-semibold">
                            Destination
                          </div>

                          <div className="mt-1 text-[11px] leading-4 text-[#45464d]">
                            {
                              currentOrder.delivery_address
                            }
                          </div>

                        </div>

                      </div>

                    </div>
                  )}

                  {/* Map controls */}
                  <div className="absolute bottom-5 left-5 flex flex-col gap-1">

                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded border border-[#c6c6cd] bg-white shadow-sm"
                    >
                      <SvgIcon
                        type="plus"
                        size={16}
                      />
                    </button>

                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded border border-[#c6c6cd] bg-white shadow-sm"
                    >
                      <SvgIcon
                        type="minus"
                        size={16}
                      />
                    </button>

                    <button
                      type="button"
                      className="mt-2 flex h-8 w-8 items-center justify-center rounded border border-[#c6c6cd] bg-white shadow-sm"
                    >
                      <SvgIcon
                        type="target"
                        size={16}
                      />
                    </button>

                  </div>

                </div>

                <div className="border-t border-[#c6c6cd] bg-white p-3 text-center text-xs text-[#45464d]">
                  Last synced: Just now
                </div>

              </section>

              {/* =================================================
                  PACKAGE INFORMATION
              ================================================== */}
              {currentOrder && (
                <section className="rounded-xl border border-[#c6c6cd] bg-white p-5">

                  <div className="mb-4 flex items-center justify-between">

                    <h2 className="font-semibold">
                      Package Information
                    </h2>

                    <SvgIcon
                      type="package"
                      size={19}
                    />

                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <div>

                      <div className="text-xs text-[#45464d]">
                        Type
                      </div>

                      <div className="mt-1 text-sm font-medium">
                        {
                          currentOrder.package_type
                        }
                      </div>

                    </div>

                    <div>

                      <div className="text-xs text-[#45464d]">
                        Weight
                      </div>

                      <div className="mt-1 text-sm font-medium">
                        {
                          currentOrder.package_weight
                        }{" "}
                        kg
                      </div>

                    </div>

                    <div>

                      <div className="text-xs text-[#45464d]">
                        Delivery Type
                      </div>

                      <div className="mt-1 text-sm font-medium">
                        {formatStatus(
                          currentOrder.delivery_type
                        )}
                      </div>

                    </div>

                    <div>

                      <div className="text-xs text-[#45464d]">
                        Payment
                      </div>

                      <div className="mt-1 text-sm font-medium">
                        {currentOrder.payment_method.toUpperCase()}
                      </div>

                    </div>

                  </div>

                </section>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
