import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrackingEventSchema } from "@/validations/tracking";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

// ============================================================
// STATUS WORKFLOW
// ============================================================

/**
 * Normal delivery lifecycle.
 * Agents must follow this sequence without skipping or moving back.
 */
const STATUS_FLOW = [
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

type NormalStatus = (typeof STATUS_FLOW)[number];

/**
 * Exception statuses are intentionally handled separately from
 * the normal lifecycle. In particular, "failed" is used by the
 * Agent Dashboard's "Mark Exception" action.
 */
const EXCEPTION_STATUSES = ["failed"] as const;

type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

const ADMIN_ONLY_STATUSES = ["rescheduled", "cancelled"] as const;

type AdminOnlyStatus = (typeof ADMIN_ONLY_STATUSES)[number];

const TERMINAL_STATUSES = new Set(["delivered", "cancelled"]);

const ALL_TRACKING_STATUSES = [
  ...STATUS_FLOW,
  ...EXCEPTION_STATUSES,
  ...ADMIN_ONLY_STATUSES,
] as const;

// ============================================================
// HELPERS
// ============================================================

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function getStatusIndex(status: string): number {
  return STATUS_FLOW.indexOf(
    normalizeStatus(status) as NormalStatus
  );
}

function isNormalStatus(status: string): status is NormalStatus {
  return STATUS_FLOW.includes(normalizeStatus(status) as NormalStatus);
}

function isExceptionStatus(status: string): status is ExceptionStatus {
  return EXCEPTION_STATUSES.includes(
    normalizeStatus(status) as ExceptionStatus
  );
}

function isAdminOnlyStatus(status: string): status is AdminOnlyStatus {
  return ADMIN_ONLY_STATUSES.includes(
    normalizeStatus(status) as AdminOnlyStatus
  );
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isValidTrackingStatus(status: string): boolean {
  return ALL_TRACKING_STATUSES.includes(
    normalizeStatus(status) as (typeof ALL_TRACKING_STATUSES)[number]
  );
}

// ============================================================
// GET /api/orders/[orderId]/tracking
// Retrieve tracking history for an order
// ============================================================

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // --------------------------------------------------------
    // 1. Verify authentication
    // --------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // 2. Load order
    // --------------------------------------------------------

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, status, customer_id, assigned_agent_id, pickup_address, delivery_address"
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // 3. Authorization
    // --------------------------------------------------------

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup error:", profileError);

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    const isAdmin = profile.role === "admin";
    const isCustomer =
      profile.role === "customer" && order.customer_id === user.id;
    const isAssignedAgent =
      profile.role === "delivery_agent" &&
      order.assigned_agent_id === user.id;

    if (!isAdmin && !isCustomer && !isAssignedAgent) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to view this order's tracking.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------------
    // 4. Retrieve tracking events
    // --------------------------------------------------------

    const { data: events, error: eventsError } = await supabase
      .from("tracking_events")
      .select(
        "id, order_id, status, description, location, updated_by, created_at"
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("Tracking retrieval error:", eventsError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to retrieve tracking history.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 5. Return tracking information
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        orderId,
        currentStatus: order.status,
        count: events?.length ?? 0,
        events: events ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get tracking error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/orders/[orderId]/tracking
// Create a tracking event
// ============================================================

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // --------------------------------------------------------
    // 1. Verify authentication
    // --------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // 2. Load order
    // --------------------------------------------------------

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, customer_id, assigned_agent_id, rescheduled_date, delivery_attempt, failure_reason, failed_at")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // 3. Get user's profile
    // --------------------------------------------------------

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup error:", profileError);

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 4. Authorization
    // --------------------------------------------------------

    const isAdmin = profile.role === "admin";

    const isAssignedAgent =
      profile.role === "delivery_agent" &&
      order.assigned_agent_id === user.id;

    if (!isAdmin && !isAssignedAgent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only admins or the assigned delivery agent can create tracking events.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------------
    // 5. Read and validate request body
    // --------------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must contain valid JSON.",
        },
        { status: 400 }
      );
    }

    const validationResult = createTrackingEventSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tracking event data.",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { status, description, location } = validationResult.data;

    // --------------------------------------------------------
    // 6. Normalize requested status
    // --------------------------------------------------------

    const requestedStatus = normalizeStatus(status);

    if (!isValidTrackingStatus(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tracking status: ${status}`,
          allowedStatuses: ALL_TRACKING_STATUSES,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 7. Determine current status
    // --------------------------------------------------------

    const currentStatus = normalizeStatus(order.status ?? "pending");
    const currentIndex = getStatusIndex(currentStatus);

    // --------------------------------------------------------
    // 8. Terminal-order protection
    // --------------------------------------------------------

    if (TERMINAL_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `This order is already in a terminal status: ${formatStatus(
            currentStatus
          )}. No further tracking events can be added.`,
          currentStatus,
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // 9. Role restrictions for exception statuses
    // --------------------------------------------------------

    if (isAdminOnlyStatus(requestedStatus) && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: `Only an administrator can set an order to "${formatStatus(
            requestedStatus
          )}".`,
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------------
    // 9A. Validate rescheduling transition
    // --------------------------------------------------------

    if (requestedStatus === "rescheduled") {
      if (currentStatus !== "failed") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only a failed delivery can be rescheduled.",
            currentStatus: order.status,
          },
          { status: 409 }
        );
      }

      if (!validationResult.data.rescheduled_date) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A rescheduled delivery date is required.",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------------
    // 10. Handle failed delivery exception
    // --------------------------------------------------------

    /**
     * "failed" is an exception branch, not part of the normal
     * assigned -> picked_up -> in_transit -> out_for_delivery ->
     * delivered sequence.
     *
     * This fixes the Agent Dashboard's "Mark Exception" action,
     * which sends status="failed".
     */
    const isFailedException = isExceptionStatus(requestedStatus);

    if (!isFailedException && !isNormalStatus(requestedStatus) && !isAdminOnlyStatus(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported tracking status: ${requestedStatus}`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 11. Validate normal delivery transitions
    // --------------------------------------------------------

    if (isNormalStatus(requestedStatus) && !isFailedException) {
      // If an order is still pending, only "assigned" is valid.
      if (currentStatus === "rescheduled") {
        if (requestedStatus !== "picked_up") {
          return NextResponse.json(
            {
              success: false,
              error:
                "A rescheduled order must restart from the pickup stage.",
              currentStatus,
              nextAllowedStatus: "picked_up",
            },
            { status: 409 }
          );
        }
      } else if (currentStatus === "pending") {
        if (requestedStatus !== "assigned") {
          return NextResponse.json(
            {
              success: false,
              error:
                "An order must be assigned before delivery progress can be updated.",
              currentStatus,
              nextAllowedStatus: "assigned",
            },
            { status: 409 }
          );
        }
      } else if (currentIndex !== -1) {
        // Same status is a duplicate update.
        if (requestedStatus === currentStatus) {
          return NextResponse.json(
            {
              success: false,
              error: `Order is already in "${formatStatus(
                requestedStatus
              )}" status.`,
            },
            { status: 409 }
          );
        }

        // Never move backwards.
        if (getStatusIndex(requestedStatus) < currentIndex) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid status transition. Order status cannot move backwards.",
              currentStatus: order.status,
              requestedStatus,
            },
            { status: 409 }
          );
        }

        // Never skip a normal workflow status.
        if (getStatusIndex(requestedStatus) > currentIndex + 1) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid status transition. The next status in the delivery workflow must be completed first.",
              currentStatus: order.status,
              requestedStatus,
              nextAllowedStatus: STATUS_FLOW[currentIndex + 1],
            },
            { status: 409 }
          );
        }
      } else if (currentStatus !== "pending") {
        // Unknown/custom database status: don't let the API guess a
        // transition and corrupt the workflow.
        return NextResponse.json(
          {
            success: false,
            error:
              `The current order status "${order.status}" is not part of the supported delivery workflow.`,
            currentStatus: order.status,
          },
          { status: 409 }
        );
      }
    }

    // --------------------------------------------------------
    // 12. Prevent duplicate tracking status
    // --------------------------------------------------------

    // A rescheduled delivery starts a new delivery attempt.
    // Therefore, statuses such as picked_up, in_transit and
    // out_for_delivery are allowed to occur again.
    const isRetryAttempt =
      Number(order.delivery_attempt ?? 1) > 1;

    const {
      data: existingEvent,
      error: existingEventError,
    } = await supabase
      .from("tracking_events")
      .select("id, status, created_at")
      .eq("order_id", orderId)
      .eq("status", requestedStatus)
      .limit(1)
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Existing tracking event check error:",
        existingEventError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify existing tracking status.",
        },
        { status: 500 }
      );
    }

    if (existingEvent && !isRetryAttempt) {
      return NextResponse.json(
        {
          success: false,
          error: `Tracking event "${formatStatus(
            requestedStatus
          )}" already exists for this order.`,
          event: existingEvent,
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // 13. Create tracking event
    // --------------------------------------------------------

    const { data: event, error: eventError } = await supabase
      .from("tracking_events")
      .insert({
        order_id: orderId,
        status: requestedStatus,
        description: description ?? null,
        location: location ?? null,
        updated_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Tracking event creation error:", eventError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create tracking event.",
          details: eventError.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 14. Update order's current status
    // --------------------------------------------------------

    const orderUpdate: {
      status: string;
      updated_at: string;
      rescheduled_date?: string;
      delivery_attempt?: number;
    } = {
      status: requestedStatus,
      updated_at: new Date().toISOString(),
    };

    // --------------------------------------------------------
    // Rescheduling-specific order updates
    // --------------------------------------------------------

    if (requestedStatus === "rescheduled") {
      const rescheduledDate =
        validationResult.data.rescheduled_date;

      if (!rescheduledDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A rescheduled delivery date is required.",
          },
          { status: 400 }
        );
      }

      orderUpdate.rescheduled_date = rescheduledDate;
      orderUpdate.delivery_attempt =
        Number(order.delivery_attempt ?? 1) + 1;
    }

    const { data: updatedOrder, error: updateOrderError } =
      await supabase
        .from("orders")
        .update(orderUpdate)
        .eq("id", orderId)
        .select(
          "id, status, updated_at, rescheduled_date, delivery_attempt"
        )
        .single();

    if (updateOrderError || !updatedOrder) {
      console.error("Order status update error:", updateOrderError);

      return NextResponse.json(
        {
          success: false,
          error:
            "Tracking event was created, but order status could not be updated.",
          event,
          details: updateOrderError?.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 15. Success
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        message: "Tracking event created successfully.",
        event,
        orderStatus: updatedOrder.status,
        order: updatedOrder,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create tracking event error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}