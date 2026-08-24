"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ============================================================
// TYPES
// ============================================================

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

type DeliveryAgent = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  zone_id: string | null;
  is_available: boolean;
};

type AgentResponse = {
  success: boolean;
  agent?: DeliveryAgent;
  error?: string;
};

type OrderResponse = {
  success: boolean;
  order?: Order;
  error?: string;
};

// ============================================================
// HELPERS
// ============================================================

function formatStatus(status: OrderStatus) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
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

  return new Date(date).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

// ============================================================
// INFO ROW
// ============================================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-gray-100 py-4 last:border-b-0">
      <span className="text-sm text-gray-500">
        {label}
      </span>

      <span className="text-right text-sm font-semibold text-gray-900">
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : value}
      </span>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const router = useRouter();

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ==========================================================
  // DELIVERY AGENT STATE
  // ==========================================================

  const [agent, setAgent] =
    useState<DeliveryAgent | null>(null);

  const [agentLoading, setAgentLoading] =
    useState(false);

  const [agentError, setAgentError] =
    useState("");

  // ==========================================================
  // AUTO ASSIGNMENT STATE
  // ==========================================================

  const [assigningAgent, setAssigningAgent] =
    useState(false);

  const [assignmentMessage, setAssignmentMessage] =
    useState("");

  const [assignmentError, setAssignmentError] =
    useState("");

  // ==========================================================
  // RESCHEDULE STATE
  // ==========================================================

  const [rescheduledDate, setRescheduledDate] =
    useState("");

  const [rescheduling, setRescheduling] =
    useState(false);

  const [rescheduleError, setRescheduleError] =
    useState("");

  const [rescheduleSuccess, setRescheduleSuccess] =
    useState("");

  // ==========================================================
  // RESCHEDULE DELIVERY
  // ==========================================================

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

    today.setHours(
      0,
      0,
      0,
      0
    );

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
            rescheduled_date:
              rescheduledDate,
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

      if (
        !response.ok ||
        !data.success ||
        !data.order
      ) {
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
      console.error(
        "Reschedule delivery error:",
        err
      );

      setRescheduleError(
        err instanceof Error
          ? err.message
          : "Failed to reschedule the delivery."
      );
    } finally {
      setRescheduling(false);
    }
  }

  // ==========================================================
  // LOAD ORDER + ASSIGNED AGENT
  // ==========================================================

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        setAgent(null);
        setAgentError("");

        const { orderId } = await params;

        // ====================================================
        // LOAD ORDER
        // ====================================================

        const response = await fetch(
          `/api/orders/${orderId}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data: OrderResponse =
          await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.order
        ) {
          throw new Error(
            data.error ||
              "Failed to load order."
          );
        }

        setOrder(data.order);

        // ====================================================
        // LOAD ASSIGNED DELIVERY AGENT
        // ====================================================

        if (data.order.assigned_agent_id) {
          try {
            setAgentLoading(true);

            const agentResponse =
              await fetch(
                `/api/admin/agents/${data.order.assigned_agent_id}`,
                {
                  method: "GET",
                  cache: "no-store",
                }
              );

            const agentData: AgentResponse =
              await agentResponse.json();

            if (
              !agentResponse.ok ||
              !agentData.success ||
              !agentData.agent
            ) {
              throw new Error(
                agentData.error ||
                  "Failed to load delivery agent."
              );
            }

            setAgent(
              agentData.agent
            );
          } catch (agentErr) {
            console.error(
              "Admin order agent error:",
              agentErr
            );

            setAgentError(
              agentErr instanceof Error
                ? agentErr.message
                : "Unable to load delivery agent."
            );
          } finally {
            setAgentLoading(false);
          }
        }
      } catch (err) {
        console.error(
          "Admin order details error:",
          err
        );

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

  // ==========================================================
  // LOADING
  // ==========================================================

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

  // ==========================================================
  // ERROR
  // ==========================================================

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

  // ==========================================================
  // TOTAL
  // ==========================================================

  const total =
    Number(order.order_amount) +
    Number(order.delivery_fee) +
    Number(order.cod_surcharge);

  // ==========================================================
  // PAGE
  // ==========================================================

  async function handleAutoAssign() {
    if (!order?.id || assigningAgent) {
      return;
    }

    setAssigningAgent(true);
    setAssignmentMessage("");
    setAssignmentError("");

    try {
      const response = await fetch(
        `/api/orders/${order.id}/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            autoAssign: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to automatically assign a delivery agent."
        );
      }

      const method =
        data.assignment?.method;

      const distance =
        data.assignment?.distanceKm;

      let message =
        data.message ||
        "Delivery agent assigned successfully.";

      if (
        method === "gps" &&
        typeof distance === "number"
      ) {
        message +=
          ` Nearest GPS agent selected (${distance.toFixed(2)} km away).`;
      } else if (method === "zone") {
        message +=
          " Agent selected using the delivery zone.";
      }

      setAssignmentMessage(message);

      /*
       * Reload the order so assigned_agent_id
       * changes immediately in the UI.
       */
      const orderResponse = await fetch(
        `/api/orders/${order.id}`,
        {
          cache: "no-store",
        }
      );

      const orderData =
        await orderResponse.json();

      if (
        orderResponse.ok &&
        orderData.success &&
        orderData.order
      ) {
        setOrder(orderData.order);

        /*
         * Load the newly assigned agent.
         */
        if (
          orderData.order.assigned_agent_id
        ) {
          setAgentLoading(true);

          const agentResponse =
            await fetch(
              `/api/admin/agents/${orderData.order.assigned_agent_id}`,
              {
                cache: "no-store",
              }
            );

          const agentData =
            await agentResponse.json();

          if (
            agentResponse.ok &&
            agentData.success &&
            agentData.agent
          ) {
            setAgent(agentData.agent);
            setAgentError("");
          }
        }
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Auto assignment error:",
        error
      );

      setAssignmentError(
        error instanceof Error
          ? error.message
          : "Failed to automatically assign a delivery agent."
      );
    } finally {
      setAgentLoading(false);
      setAssigningAgent(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* ====================================================
            BACK
        ==================================================== */}

        <div className="mb-6">
          <Link
            href="/dashboard/admin/orders"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to Order Management
          </Link>
        </div>

        {/* ====================================================
            HEADER
        ==================================================== */}

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
                Created{" "}
                {formatDateTime(
                  order.created_at
                )}
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

        {/* ====================================================
            DELIVERY ROUTE
        ==================================================== */}

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

            {/* PICKUP */}

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Pickup
              </p>

              <p className="mt-3 text-base font-semibold text-gray-900">
                {order.pickup_address}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Zone:{" "}
                {order.pickup_zone_id ||
                  "Not assigned"}
              </p>
            </div>

            {/* DELIVERY */}

            <div className="rounded-xl border border-green-100 bg-green-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Delivery
              </p>

              <p className="mt-3 text-base font-semibold text-gray-900">
                {order.delivery_address}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Zone:{" "}
                {order.delivery_zone_id ||
                  "Not assigned"}
              </p>
            </div>
          </div>
        </section>

        {/* ====================================================
            MAIN INFORMATION
        ==================================================== */}

        <div className="grid gap-6 lg:grid-cols-2">

          {/* ==================================================
              PACKAGE
          ================================================== */}

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
                value={
                  order.package_type
                }
              />

              <InfoRow
                label="Actual Weight"
                value={`${order.package_weight} kg`}
              />

              <InfoRow
                label="Volumetric Weight"
                value={
                  order.volumetric_weight !==
                  null
                    ? `${order.volumetric_weight} kg`
                    : "—"
                }
              />

              <InfoRow
                label="Chargeable Weight"
                value={
                  order.chargeable_weight !==
                  null
                    ? `${order.chargeable_weight} kg`
                    : "—"
                }
              />

              <InfoRow
                label="Dimensions"
                value={
                  order.package_length !==
                    null &&
                  order.package_width !==
                    null &&
                  order.package_height !==
                    null
                    ? `${order.package_length} × ${order.package_width} × ${order.package_height} cm`
                    : "—"
                }
              />

              <InfoRow
                label="Order Type"
                value={
                  order.order_type
                }
              />

              <InfoRow
                label="Delivery Type"
                value={
                  order.delivery_type
                }
              />
            </div>
          </section>

          {/* ==================================================
              PAYMENT
          ================================================== */}

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
                value={formatCurrency(
                  order.order_amount
                )}
              />

              <InfoRow
                label="Delivery Fee"
                value={formatCurrency(
                  order.delivery_fee
                )}
              />

              <InfoRow
                label="COD Surcharge"
                value={formatCurrency(
                  order.cod_surcharge
                )}
              />

              <InfoRow
                label="Payment Method"
                value={
                  order.payment_method
                }
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

          {/* ==================================================
              CUSTOMER
          ================================================== */}

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
                value={
                  order.customer_id
                }
              />

              <InfoRow
                label="Order Number"
                value={
                  order.order_number
                }
              />

              <InfoRow
                label="Created"
                value={formatDateTime(
                  order.created_at
                )}
              />

              <InfoRow
                label="Last Updated"
                value={formatDateTime(
                  order.updated_at
                )}
              />
            </div>
          </section>

          {/* ==================================================
              DELIVERY AGENT
          ================================================== */}

          <section className="rounded-xl bg-white p-6 shadow-sm">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Delivery Agent
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Current assignment information
                </p>
              </div>

              {agent && (
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    agent.is_available
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      agent.is_available
                        ? "bg-green-500"
                        : "bg-orange-500"
                    }`}
                  />

                  {agent.is_available
                    ? "Available"
                    : "Busy"}
                </span>
              )}
            </div>

            {/* ==================================================
                UNASSIGNED
            ================================================== */}

            {!order.assigned_agent_id ? (
              <div className="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">

                <p className="text-sm font-semibold text-yellow-800">
                  This order has not been assigned to a delivery agent.
                </p>

                <p className="mt-1 text-xs text-yellow-700">
                  An available delivery agent can be assigned during order processing.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">

                  <button
                    type="button"
                    onClick={handleAutoAssign}
                    disabled={assigningAgent}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningAgent ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        📍
                        Auto Assign Nearest Agent
                      </>
                    )}
                  </button>

                </div>

                {assignmentMessage && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-semibold text-green-800">
                      {assignmentMessage}
                    </p>
                  </div>
                )}

                {assignmentError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">
                      Auto assignment failed
                    </p>

                    <p className="mt-1 text-xs text-red-700">
                      {assignmentError}
                    </p>
                  </div>
                )}

              </div>

            ) : agentLoading ? (

              /* ==================================================
                 LOADING AGENT
              ================================================== */

              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-5">

                <div className="flex items-center gap-3">

                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />

                  <p className="text-sm text-gray-600">
                    Loading delivery agent...
                  </p>

                </div>
              </div>

            ) : agentError ? (

              /* ==================================================
                 AGENT ERROR
              ================================================== */

              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">

                <p className="text-sm font-semibold text-red-800">
                  Unable to load delivery agent
                </p>

                <p className="mt-1 text-xs text-red-700">
                  {agentError}
                </p>

                <div className="mt-4">

                  <Link
                    href={`/dashboard/admin/agents/${order.assigned_agent_id}`}
                    className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    View Agent
                  </Link>

                </div>
              </div>

            ) : agent ? (

              /* ==================================================
                 AGENT DETAILS
              ================================================== */

              <div className="mt-5">

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">

                  {/* AGENT HEADER */}

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-4">

                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                        {agent.full_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>

                        <p className="text-lg font-bold text-gray-900">
                          {agent.full_name}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Delivery Agent
                        </p>

                      </div>
                    </div>

                    <Link
                      href={`/dashboard/admin/agents/${agent.id}`}
                      className="inline-flex w-fit items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      View Agent →
                    </Link>

                  </div>

                  {/* AGENT INFORMATION */}

                  <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2">

                    {/* PHONE */}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Phone
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {agent.phone || "—"}
                      </p>
                    </div>

                    {/* STATUS */}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Status
                      </p>

                      <p
                        className={`mt-1 text-sm font-semibold ${
                          agent.is_available
                            ? "text-green-600"
                            : "text-orange-600"
                        }`}
                      >
                        {agent.is_available
                          ? "Available"
                          : "Busy"}
                      </p>
                    </div>

                    {/* ZONE */}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Zone
                      </p>

                      <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                        {agent.zone_id ||
                          "Not assigned"}
                      </p>
                    </div>

                    {/* AGENT ID */}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Agent ID
                      </p>

                      <p className="mt-1 break-all text-xs font-medium text-gray-500">
                        {agent.id}
                      </p>
                    </div>

                  </div>
                </div>

                {/* DELIVERY ATTEMPT */}

                <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">

                  <div>

                    <p className="text-sm font-semibold text-blue-900">
                      Delivery Attempt
                    </p>

                    <p className="mt-1 text-xs text-blue-700">
                      Current attempt for this order
                    </p>

                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                    Attempt{" "}
                    {order.delivery_attempt}
                  </span>

                </div>

              </div>

            ) : (

              /* ==================================================
                 FALLBACK
              ================================================== */

              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">

                <p className="text-sm text-gray-600">
                  Agent information is not available.
                </p>

              </div>
            )}

          </section>
        </div>

        {/* ====================================================
            DELIVERY STATUS
        ==================================================== */}

        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm md:p-8">

          <h2 className="text-xl font-bold text-gray-900">
            Delivery Status
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Current delivery state and exception information
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* CURRENT STATUS */}

            <div className="rounded-lg bg-gray-50 p-4">

              <p className="text-xs text-gray-500">
                Current Status
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatStatus(
                  order.status
                )}
              </p>

            </div>

            {/* EXPECTED DELIVERY */}

            <div className="rounded-lg bg-gray-50 p-4">

              <p className="text-xs text-gray-500">
                Expected Delivery
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatDate(
                  order.expected_delivery_date
                )}
              </p>

            </div>

            {/* DELIVERY ATTEMPT */}

            <div className="rounded-lg bg-gray-50 p-4">

              <p className="text-xs text-gray-500">
                Delivery Attempt
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {order.delivery_attempt}
              </p>

            </div>

            {/* RESCHEDULED DATE */}

            <div className="rounded-lg bg-gray-50 p-4">

              <p className="text-xs text-gray-500">
                Rescheduled Date
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {formatDate(
                  order.rescheduled_date
                )}
              </p>

            </div>
          </div>

          {/* FAILED DELIVERY */}

          {order.status === "failed" &&
            order.failure_reason && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">

                <p className="text-sm font-semibold text-red-800">
                  Failed Delivery Reason
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {order.failure_reason}
                </p>

                {order.failed_at && (
                  <p className="mt-2 text-xs text-red-600">
                    Failed at:{" "}
                    {formatDateTime(
                      order.failed_at
                    )}
                  </p>
                )}

              </div>
            )}
        </section>

        {/* ====================================================
            ADMIN ACTIONS
        ==================================================== */}

        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">

          <h2 className="text-xl font-bold text-gray-900">
            Admin Actions
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Administrative tools for this order
          </p>

          {/* ==================================================
              RESCHEDULE
          ================================================== */}

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
                  value={
                    rescheduledDate
                  }
                  min={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  onChange={(event) => {
                    setRescheduledDate(
                      event.target.value
                    );

                    setRescheduleError(
                      ""
                    );

                    setRescheduleSuccess(
                      ""
                    );
                  }}
                  disabled={
                    rescheduling
                  }
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
                  onClick={
                    handleReschedule
                  }
                  disabled={
                    rescheduling ||
                    !rescheduledDate
                  }
                  className="mt-4 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rescheduling
                    ? "Rescheduling..."
                    : "Reschedule Delivery"}
                </button>

              </div>
            </div>
          )}

          {/* ==================================================
              ACTION BUTTONS
          ================================================== */}

          <div className="mt-5 flex flex-wrap gap-3">

            <Link
              href={`/dashboard/admin/orders/${order.id}/tracking`}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              View Tracking
            </Link>

            {order.assigned_agent_id && (
              <Link
                href={`/dashboard/admin/agents/${order.assigned_agent_id}`}
                className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                View Delivery Agent
              </Link>
            )}

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