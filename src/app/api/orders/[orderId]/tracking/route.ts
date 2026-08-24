import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTrackingEventSchema } from "@/validations/tracking";
import { sendTrackingStatusEmail } from "@/lib/email/resend";
import { sendTrackingStatusSms } from "@/lib/sms/twilio";
type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

// ============================================================
// STATUS WORKFLOW
// ============================================================

const STATUS_FLOW = [
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

type NormalStatus = (typeof STATUS_FLOW)[number];

const EXCEPTION_STATUSES = ["failed"] as const;

type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

const ADMIN_ONLY_STATUSES = ["cancelled"] as const;

type AdminOnlyStatus =
  (typeof ADMIN_ONLY_STATUSES)[number];

const CUSTOMER_ALLOWED_STATUSES = [
  "rescheduled",
] as const;

type CustomerAllowedStatus =
  (typeof CUSTOMER_ALLOWED_STATUSES)[number];

const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
]);

const ALL_TRACKING_STATUSES = [
  ...STATUS_FLOW,
  ...EXCEPTION_STATUSES,
  "rescheduled",
  ...ADMIN_ONLY_STATUSES,
] as const;

// ============================================================
// HELPERS
// ============================================================

function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getStatusIndex(status: string): number {
  return STATUS_FLOW.indexOf(
    normalizeStatus(status) as NormalStatus
  );
}

function isNormalStatus(
  status: string
): status is NormalStatus {
  return STATUS_FLOW.includes(
    normalizeStatus(status) as NormalStatus
  );
}

function isExceptionStatus(
  status: string
): status is ExceptionStatus {
  return EXCEPTION_STATUSES.includes(
    normalizeStatus(status) as ExceptionStatus
  );
}

function isAdminOnlyStatus(
  status: string
): status is AdminOnlyStatus {
  return ADMIN_ONLY_STATUSES.includes(
    normalizeStatus(status) as AdminOnlyStatus
  );
}

function isCustomerAllowedStatus(
  status: string
): status is CustomerAllowedStatus {
  return CUSTOMER_ALLOWED_STATUSES.includes(
    normalizeStatus(status) as CustomerAllowedStatus
  );
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function isValidTrackingStatus(
  status: string
): boolean {
  return ALL_TRACKING_STATUSES.includes(
    normalizeStatus(status) as
      (typeof ALL_TRACKING_STATUSES)[number]
  );
}

// ============================================================
// FIND AVAILABLE DELIVERY AGENT
// ============================================================
//
// This function is used during rescheduling.
//
// The service-role client is used because agent lookup is a
// server-side privileged operation and must not depend on the
// customer's RLS permissions.
//
// The previous agent is avoided whenever another available
// agent exists.
// ============================================================

async function findAvailableDeliveryAgent(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
  currentAgentId?: string | null,
  deliveryZoneId?: string | null,
  deliveryLatitude?: number | null,
  deliveryLongitude?: number | null
) {
  const {
    data,
    error,
  } = await adminSupabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        role,
        zone_id,
        is_available,
        current_latitude,
        current_longitude,
        created_at
      `
    )
    .eq("role", "delivery_agent")
    .eq("is_available", true)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Available agent lookup error:",
      error
    );

    throw new Error(
      "Failed to find an available delivery agent."
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Prefer a different agent during rescheduling.
  let candidates = data.filter(
    (agent) =>
      agent.id !== currentAgentId
  );

  // If the previous agent is the only available agent,
  // allow that agent as a fallback.
  if (candidates.length === 0) {
    candidates = data;
  }

  // Prefer agents in the delivery zone.
  if (deliveryZoneId) {
    const sameZoneAgents =
      candidates.filter(
        (agent) =>
          agent.zone_id ===
          deliveryZoneId
      );

    if (sameZoneAgents.length > 0) {
      candidates = sameZoneAgents;
    }
  }

  // ------------------------------------------------------------
  // Find nearest agent using GPS
  // ------------------------------------------------------------

  const hasDeliveryCoordinates =
    Number.isFinite(
      deliveryLatitude
    ) &&
    Number.isFinite(
      deliveryLongitude
    );

  if (hasDeliveryCoordinates) {
    const earthRadiusKm = 6371;

    const toRadians = (
      degrees: number
    ) =>
      (degrees * Math.PI) / 180;

    const agentsWithDistance =
      candidates
        .map((agent) => {
          const agentLatitude =
            Number(
              agent.current_latitude
            );

          const agentLongitude =
            Number(
              agent.current_longitude
            );

          // Agent does not have GPS coordinates.
          if (
            !Number.isFinite(
              agentLatitude
            ) ||
            !Number.isFinite(
              agentLongitude
            )
          ) {
            return {
              agent,
              distanceKm:
                null as number | null,
            };
          }

          // Haversine formula.
          const deltaLatitude =
            toRadians(
              (deliveryLatitude as number) -
                agentLatitude
            );

          const deltaLongitude =
            toRadians(
              (deliveryLongitude as number) -
                agentLongitude
            );

          const a =
            Math.sin(
              deltaLatitude / 2
            ) ** 2 +
            Math.cos(
              toRadians(
                agentLatitude
              )
            ) *
              Math.cos(
                toRadians(
                  deliveryLatitude as number
                )
              ) *
              Math.sin(
                deltaLongitude / 2
              ) ** 2;

          const c =
            2 *
            Math.atan2(
              Math.sqrt(a),
              Math.sqrt(1 - a)
            );

          return {
            agent,
            distanceKm:
              earthRadiusKm * c,
          };
        })
        .sort((a, b) => {
          // Agents with GPS are preferred.
          if (
            a.distanceKm !== null &&
            b.distanceKm === null
          ) {
            return -1;
          }

          if (
            a.distanceKm === null &&
            b.distanceKm !== null
          ) {
            return 1;
          }

          // Both have GPS:
          // nearest agent wins.
          if (
            a.distanceKm !== null &&
            b.distanceKm !== null
          ) {
            return (
              a.distanceKm -
              b.distanceKm
            );
          }

          // Neither has GPS:
          // deterministic fallback.
          return (
            new Date(
              a.agent.created_at
            ).getTime() -
            new Date(
              b.agent.created_at
            ).getTime()
          );
        });

    if (
      agentsWithDistance.length > 0
    ) {
      return agentsWithDistance[0]
        .agent;
    }
  }

  // Final fallback.
  return candidates[0] ?? null;
}

// ============================================================
// GET /api/orders/[orderId]/tracking
// ============================================================
//
// Retrieve tracking history for an order.
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

    const supabase =
      await createClient();

    // --------------------------------------------------------
    // 1. Authentication
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

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        `
          id,
          status,
          customer_id,
          assigned_agent_id,
          pickup_address,
          delivery_address,
          rescheduled_date,
          delivery_attempt,
          failure_reason,
          failed_at
        `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error(
        "Order lookup error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // 3. Load profile
    // --------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 4. Authorization
    // --------------------------------------------------------

    const isAdmin =
      profile.role === "admin";

    const isCustomer =
      profile.role === "customer" &&
      order.customer_id === user.id;

    const isAssignedAgent =
      profile.role === "delivery_agent" &&
      order.assigned_agent_id === user.id;

    if (
      !isAdmin &&
      !isCustomer &&
      !isAssignedAgent
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are not authorized to view this order's tracking.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------------
    // 5. Retrieve tracking events
    // --------------------------------------------------------

    const {
      data: events,
      error: eventsError,
    } = await supabase
      .from("tracking_events")
      .select(
        `
          id,
          order_id,
          status,
          description,
          location,
          latitude,
          longitude,
          updated_by,
          created_at
        `
      )
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true,
      });

    if (eventsError) {
      console.error(
        "Tracking retrieval error:",
        eventsError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to retrieve tracking history.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 6. Return tracking information
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        orderId,
        currentStatus: order.status,
        count: events?.length ?? 0,
        order,
        events: events ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Get tracking error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/orders/[orderId]/tracking
// ============================================================
//
// Create a tracking event.
//
// Authorization is performed using the authenticated user.
//
// Database writes are performed with the server-side
// service-role client AFTER authorization has succeeded.
// This prevents customer RLS INSERT restrictions from breaking
// legitimate customer rescheduling.
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

    // ========================================================
    // 1. AUTHENTICATED USER CLIENT
    // ========================================================

    const supabase =
      await createClient();

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

    // ========================================================
    // 2. LOAD ORDER
    // ========================================================

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          status,
          customer_id,
          assigned_agent_id,
          delivery_zone_id,
          pickup_address,
          delivery_address,
          delivery_latitude,
          delivery_longitude,
          rescheduled_date,
          delivery_attempt,
          failure_reason,
          failed_at
        `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error(
        "Order lookup error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // 3. LOAD USER PROFILE
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    const isAdmin =
      profile.role === "admin";

    const isCustomer =
      profile.role === "customer" &&
      order.customer_id === user.id;

    const isAssignedAgent =
      profile.role === "delivery_agent" &&
      order.assigned_agent_id === user.id;

    // ========================================================
    // 4. READ AND VALIDATE REQUEST BODY
    // ========================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Request body must contain valid JSON.",
        },
        { status: 400 }
      );
    }

    const validationResult =
      createTrackingEventSchema.safeParse(
        body
      );

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid tracking event data.",
          details:
            validationResult.error.flatten()
              .fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      status,
      description,
      location,
      latitude,
      longitude,
      rescheduled_date,
    } = validationResult.data;

    const requestedStatus =
      normalizeStatus(status);

    if (
      !isValidTrackingStatus(
        requestedStatus
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tracking status: ${status}`,
          allowedStatuses:
            ALL_TRACKING_STATUSES,
        },
        { status: 400 }
      );
    }

    const currentStatus =
      normalizeStatus(
        order.status ?? "pending"
      );

    const currentIndex =
      getStatusIndex(currentStatus);

    // ========================================================
    // 5. AUTHORIZATION BY REQUESTED STATUS
    // ========================================================

    const isRescheduling =
      isCustomerAllowedStatus(
        requestedStatus
      );

    if (isRescheduling) {
      // ------------------------------------------------------
      // Customer can reschedule ONLY their own failed order.
      // ------------------------------------------------------

      const canCustomerReschedule =
        isCustomer &&
        currentStatus === "failed";

      // ------------------------------------------------------
      // Admin can reschedule a failed order.
      // ------------------------------------------------------

      const canAdminReschedule =
        isAdmin &&
        currentStatus === "failed";

      if (
        !canCustomerReschedule &&
        !canAdminReschedule
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only the customer who owns a failed order or an administrator can reschedule it.",
            currentStatus,
          },
          { status: 403 }
        );
      }
    } else {
      // ------------------------------------------------------
      // Normal tracking events are only allowed for admins
      // or the currently assigned delivery agent.
      // ------------------------------------------------------

      if (
        !isAdmin &&
        !isAssignedAgent
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only admins or the assigned delivery agent can create tracking events.",
          },
          { status: 403 }
        );
      }
    }

    // ========================================================
    // 6. TERMINAL ORDER PROTECTION
    // ========================================================

    if (
      TERMINAL_STATUSES.has(
        currentStatus
      )
    ) {
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

    // ========================================================
    // 7. RESCHEDULING VALIDATION
    // ========================================================

    if (isRescheduling) {
      if (currentStatus !== "failed") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only a failed delivery can be rescheduled.",
            currentStatus,
          },
          { status: 409 }
        );
      }

      if (!rescheduled_date) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A rescheduled delivery date is required.",
          },
          { status: 400 }
        );
      }

      // Prevent scheduling in the past.
      const today =
        new Date();

      const todayString =
        `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(
          today.getDate()
        ).padStart(2, "0")}`;

      if (
        rescheduled_date <
        todayString
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Rescheduled delivery date cannot be in the past.",
          },
          { status: 400 }
        );
      }
    }

    // ========================================================
    // 8. NORMAL WORKFLOW VALIDATION
    // ========================================================

    if (
      isNormalStatus(
        requestedStatus
      )
    ) {
      // ------------------------------------------------------
      // A rescheduled order starts again from pickup.
      // ------------------------------------------------------

      if (
        currentStatus ===
        "rescheduled"
      ) {
        if (
          requestedStatus !==
          "picked_up"
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "A rescheduled order must restart from the pickup stage.",
              currentStatus,
              nextAllowedStatus:
                "picked_up",
            },
            { status: 409 }
          );
        }
      }

      // ------------------------------------------------------
      // Pending orders must first be assigned.
      // ------------------------------------------------------

      else if (
        currentStatus ===
        "pending"
      ) {
        if (
          requestedStatus !==
          "assigned"
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "An order must be assigned before delivery progress can be updated.",
              currentStatus,
              nextAllowedStatus:
                "assigned",
            },
            { status: 409 }
          );
        }
      }

      // ------------------------------------------------------
      // Normal delivery lifecycle.
      // ------------------------------------------------------

      else if (
        currentIndex !== -1
      ) {
        // Prevent same-status updates.
        if (
          requestedStatus ===
          currentStatus
        ) {
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

        // Prevent backwards movement.
        if (
          getStatusIndex(
            requestedStatus
          ) < currentIndex
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid status transition. Order status cannot move backwards.",
              currentStatus:
                order.status,
              requestedStatus,
            },
            { status: 409 }
          );
        }

        // Prevent skipped statuses.
        if (
          getStatusIndex(
            requestedStatus
          ) >
          currentIndex + 1
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid status transition. The next status in the delivery workflow must be completed first.",
              currentStatus:
                order.status,
              requestedStatus,
              nextAllowedStatus:
                STATUS_FLOW[
                  currentIndex + 1
                ],
            },
            { status: 409 }
          );
        }
      }
    }

    // ========================================================
    // 9. FAILED DELIVERY VALIDATION
    // ========================================================

    if (
      requestedStatus ===
      "failed"
    ) {
      if (
        currentStatus !==
          "assigned" &&
        currentStatus !==
          "picked_up" &&
        currentStatus !==
          "in_transit" &&
        currentStatus !==
          "out_for_delivery"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A delivery can only be marked failed after it has been assigned.",
            currentStatus,
          },
          { status: 409 }
        );
      }

      if (
        !description?.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A failure reason is required.",
          },
          { status: 400 }
        );
      }
    }

    // ========================================================
    // 10. CREATE ADMIN CLIENT
    // ========================================================
    //
    // IMPORTANT:
    //
    // Authentication and authorization above use the normal
    // authenticated client.
    //
    // From this point onward, server-side privileged database
    // operations use the service-role client.
    //
    // This prevents legitimate customer rescheduling from
    // failing because tracking_events INSERT is protected by
    // RLS.
    //
    // The service-role client is NEVER exposed to the browser.
    // ========================================================

    const adminSupabase =
      createAdminClient();

    // ========================================================
    // 11. DUPLICATE TRACKING PROTECTION
    // ========================================================

    const isRetryAttempt =
      Number(
        order.delivery_attempt ??
          1
      ) > 1;

    const {
      data: existingEvents,
      error:
        existingEventError,
    } = await adminSupabase
      .from("tracking_events")
      .select(
        "id, status, created_at"
      )
      .eq(
        "order_id",
        orderId
      )
      .eq(
        "status",
        requestedStatus
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (existingEventError) {
      console.error(
        "Existing tracking event check error:",
        existingEventError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify existing tracking status.",
          details:
            existingEventError.message,
          code:
            existingEventError.code,
          hint:
            existingEventError.hint,
        },
        { status: 500 }
      );
    }

    const existingEvent =
      existingEvents?.[0] ?? null;

    // A rescheduled event is allowed even when the order has
    // previously had another rescheduled event.
    //
    // A retry attempt may also legitimately contain a status
    // that appeared in a previous delivery attempt.
    if (
      existingEvent &&
      !isRetryAttempt &&
      !isRescheduling
    ) {
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

    // ========================================================
    // 12. FIND NEW AGENT FOR RESCHEDULED ATTEMPT
    // ========================================================

    let newAgent:
      | {
          id: string;
          full_name: string | null;
          zone_id: string | null;
          is_available: boolean;
        }
      | null = null;

    if (
      isRescheduling
    ) {
      newAgent =
        await findAvailableDeliveryAgent(
          adminSupabase,
          order.assigned_agent_id,
          order.delivery_zone_id,
          order.delivery_latitude,
          order.delivery_longitude
        );
    }

    // ========================================================
    // 13. CREATE TRACKING EVENT
    // ========================================================

    const eventDescription =
      isRescheduling
        ? description?.trim() ||
          `Delivery rescheduled for ${rescheduled_date}.`
        : description ??
          null;

    const {
      data: event,
      error: eventError,
    } = await adminSupabase
      .from("tracking_events")
      .insert({
        order_id:
          orderId,

        status:
          requestedStatus,

        description:
          eventDescription,

        location:
          location ??
          null,

        latitude:
          latitude ??
          null,

        longitude:
          longitude ??
          null,

        updated_by:
          user.id,
      })
      .select()
      .single();

    if (
      eventError ||
      !event
    ) {
      console.error(
        "Tracking event creation error:",
        eventError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to create tracking event.",
          details:
            eventError?.message ??
            null,
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 14. BUILD ORDER UPDATE
    // ========================================================

    const orderUpdate: {
      status: string;
      updated_at: string;
      rescheduled_date?: string | null;
      delivery_attempt?: number;
      assigned_agent_id?: string | null;
      failure_reason?: string | null;
      failed_at?: string | null;
    } = {
      status:
        requestedStatus,

      updated_at:
        new Date().toISOString(),
    };

    // ========================================================
    // FAILED DELIVERY
    // ========================================================

    if (
      requestedStatus ===
      "failed"
    ) {
      orderUpdate.failure_reason =
        description?.trim() ||
        null;

      orderUpdate.failed_at =
        new Date().toISOString();
    }

    // ========================================================
    // RESCHEDULED DELIVERY
    // ========================================================

    if (
      isRescheduling
    ) {
      orderUpdate.rescheduled_date =
        rescheduled_date;

      orderUpdate.delivery_attempt =
        Number(
          order.delivery_attempt ??
            1
        ) + 1;

      // Assign another available agent.
      //
      // If no different agent is available,
      // this becomes null and the order can be
      // manually assigned by the admin later.
      orderUpdate.assigned_agent_id =
        newAgent?.id ??
        null;

      // Clear previous failure information
      // because a new attempt is starting.
      orderUpdate.failure_reason =
        null;

      orderUpdate.failed_at =
        null;
    }

    // ========================================================
    // 15. UPDATE ORDER
    // ========================================================
    //
    // Use adminSupabase here as well because a customer
    // rescheduling an order may not have UPDATE permission
    // under the orders table RLS policy.
    // ========================================================

    const {
      data: updatedOrder,
      error:
        updateOrderError,
    } = await adminSupabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", orderId)
      .select(
        `
          id,
          status,
          updated_at,
          rescheduled_date,
          delivery_attempt,
          assigned_agent_id,
          failure_reason,
          failed_at
        `
      )
      .single();

    if (
      updateOrderError ||
      !updatedOrder
    ) {
      console.error(
        "Order status update error:",
        updateOrderError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Tracking event was created, but order status could not be updated.",
          event,
          details:
            updateOrderError?.message ??
            null,
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 16. SEND CUSTOMER EMAIL NOTIFICATION
    // ========================================================
    //
    // Email delivery is intentionally non-blocking for the
    // order workflow. The tracking event and order update have
    // already succeeded, so an email failure must not turn a
    // successful delivery-status update into a failed request.
    // ========================================================

    try {
      const {
        data: customerAuthData,
        error: customerAuthError,
      } = await adminSupabase.auth.admin.getUserById(
        order.customer_id
      );

      if (customerAuthError) {
        console.error(
          "Customer email lookup error:",
          customerAuthError
        );
      } else {
        const customerEmail =
          customerAuthData.user?.email ??
          null;

        const customerName =
          typeof customerAuthData.user?.user_metadata?.full_name ===
          "string"
            ? customerAuthData.user.user_metadata.full_name
            : typeof customerAuthData.user?.user_metadata?.name ===
                "string"
              ? customerAuthData.user.user_metadata.name
              : null;

        if (!customerEmail) {
          console.warn(
            "Customer email is missing. Tracking email was not sent.",
            {
              orderId,
              customerId: order.customer_id,
            }
          );
        } else {
          const emailResult =
            await sendTrackingStatusEmail({
              customerEmail,
              customerName,
              orderNumber: order.order_number,
              status: updatedOrder.status,
              description: eventDescription,
              location: location ?? null,
              deliveryAddress: order.delivery_address ?? null,
              rescheduledDate:
                updatedOrder.rescheduled_date ?? null,
              deliveryAttempt:
                updatedOrder.delivery_attempt ?? null,
            });

          if (emailResult.success) {
            console.log(
              "Tracking email sent successfully:",
              {
                orderId,
                orderNumber: order.order_number,
                recipient: customerEmail,
                emailId: emailResult.id ?? null,
              }
            );
          } else {
            console.error(
              "Tracking email was not sent:",
              {
                orderId,
                orderNumber: order.order_number,
                recipient: customerEmail,
                error: emailResult.error,
                skipped: emailResult.skipped,
              }
            );
          }
        }
      }
    } catch (emailError) {
      console.error(
        "Unexpected tracking email error:",
        emailError
      );
    }

        // ========================================================
    // 17. SEND CUSTOMER SMS NOTIFICATION
    // ========================================================
    //
    // SMS delivery is intentionally non-blocking.
    // A Twilio failure must never undo a successful
    // order-status update.
    // ========================================================

    try {
      const {
        data: customerProfile,
        error: customerProfileError,
      } = await adminSupabase
        .from("profiles")
        .select(
          "id, full_name, phone"
        )
        .eq(
          "id",
          order.customer_id
        )
        .single();

      if (customerProfileError) {
        console.error(
          "Customer phone lookup error:",
          customerProfileError
        );
      } else {
        const customerPhone =
          customerProfile?.phone ?? null;

        const customerName =
          customerProfile?.full_name ?? null;

        if (!customerPhone) {
          console.warn(
            "Customer phone number is missing. Tracking SMS was not sent.",
            {
              orderId,
              customerId:
                order.customer_id,
            }
          );
        } else {
          const smsResult =
            await sendTrackingStatusSms({
              customerPhone,
              customerName,
              orderNumber:
                order.order_number,
              status:
                updatedOrder.status,
              description:
                eventDescription,
              deliveryAddress:
                order.delivery_address ??
                null,
              rescheduledDate:
                updatedOrder.rescheduled_date ??
                null,
              deliveryAttempt:
                updatedOrder.delivery_attempt ??
                null,
            });

          if (smsResult.success) {
            console.log(
              "Tracking SMS sent successfully:",
              {
                orderId,
                orderNumber:
                  order.order_number,
                recipient:
                  customerPhone,
                messageSid:
                  smsResult.id ?? null,
              }
            );
          } else {
            console.error(
              "Tracking SMS was not sent:",
              {
                orderId,
                orderNumber:
                  order.order_number,
                recipient:
                  customerPhone,
                error:
                  smsResult.error,
                skipped:
                  smsResult.skipped,
              }
            );
          }
        }
      }
    } catch (smsError) {
      console.error(
        "Unexpected tracking SMS error:",
        smsError
      );
    }

    // ========================================================
    // 18. SUCCESS
    // ========================================================


    return NextResponse.json(
      {
        success: true,

        message:
          isRescheduling
            ? "Delivery rescheduled successfully."
            : "Tracking event created successfully.",

        event,

        orderStatus:
          updatedOrder.status,

        order:
          updatedOrder,

        reassignedAgent:
          newAgent
            ? {
                id:
                  newAgent.id,

                full_name:
                  newAgent.full_name,
              }
            : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create tracking event error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}