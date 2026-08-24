import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Agent = {
  id: string;
  full_name: string | null;
  role: string;
  zone_id: string | null;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
};

function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusKm = 6371;

  const lat1 = (latitude1 * Math.PI) / 180;
  const lat2 = (latitude2 * Math.PI) / 180;

  const deltaLatitude =
    ((latitude2 - latitude1) * Math.PI) / 180;

  const deltaLongitude =
    ((longitude2 - longitude1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLongitude / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}

async function requireAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      error: NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    return {
      supabase,
      user,
      profile: null,
      error: NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      ),
    };
  }

  return {
    supabase,
    user,
    profile,
    error: null,
  };
}

async function findNearestAvailableAgent(
  adminSupabase: ReturnType<typeof createAdminClient>,
  deliveryLatitude: number | null,
  deliveryLongitude: number | null,
  deliveryZoneId: string | null
) {
  const {
    data: agents,
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
        current_longitude
      `
    )
    .eq("role", "delivery_agent")
    .eq("is_available", true);

  if (error) {
    console.error(
      "Available agent lookup error:",
      error
    );

    throw new Error(
      "Failed to find available delivery agents."
    );
  }

  if (!agents || agents.length === 0) {
    return null;
  }

  // ----------------------------------------------------------
  // 1. NEAREST GPS AGENT
  // ----------------------------------------------------------

  if (
    deliveryLatitude !== null &&
    deliveryLongitude !== null
  ) {
    const gpsAgents = agents
      .filter(
        (agent) =>
          agent.current_latitude !== null &&
          agent.current_longitude !== null &&
          Number.isFinite(
            Number(agent.current_latitude)
          ) &&
          Number.isFinite(
            Number(agent.current_longitude)
          )
      )
      .map((agent) => ({
        agent,
        distanceKm: calculateDistanceKm(
          Number(deliveryLatitude),
          Number(deliveryLongitude),
          Number(agent.current_latitude),
          Number(agent.current_longitude)
        ),
      }))
      .sort(
        (a, b) =>
          a.distanceKm - b.distanceKm
      );

    if (gpsAgents.length > 0) {
      return {
        agent: gpsAgents[0].agent,
        distanceKm: gpsAgents[0].distanceKm,
        method: "gps" as const,
      };
    }
  }

  // ----------------------------------------------------------
  // 2. SAME-ZONE FALLBACK
  // ----------------------------------------------------------

  if (deliveryZoneId) {
    const sameZoneAgent = agents.find(
      (agent) =>
        agent.zone_id === deliveryZoneId
    );

    if (sameZoneAgent) {
      return {
        agent: sameZoneAgent,
        distanceKm: null,
        method: "zone" as const,
      };
    }
  }

  // ----------------------------------------------------------
  // 3. ANY AVAILABLE AGENT FALLBACK
  // ----------------------------------------------------------

  return {
    agent: agents[0],
    distanceKm: null,
    method: "fallback" as const,
  };
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  }
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

    const auth =
      await requireAuthenticatedUser();

    if (auth.error) {
      return auth.error;
    }

    const {
      user,
      profile,
    } = auth;

    const body = await request.json().catch(
      () => ({})
    );

    const requestedAgentId =
      typeof body.agentId === "string"
        ? body.agentId.trim()
        : "";

    const autoAssign =
      body.autoAssign === true;

    const isAdmin =
      profile.role === "admin";

    const isDeliveryAgent =
      profile.role === "delivery_agent";

    if (
      !isAdmin &&
      !isDeliveryAgent
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only administrators and delivery agents can assign orders.",
        },
        { status: 403 }
      );
    }

    const adminSupabase =
      createAdminClient();

    // --------------------------------------------------------
    // LOAD ORDER
    // --------------------------------------------------------

    const {
      data: order,
      error: orderError,
    } = await adminSupabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          status,
          assigned_agent_id,
          delivery_zone_id,
          delivery_latitude,
          delivery_longitude
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
    // DON'T ASSIGN ALREADY DELIVERED/CANCELLED ORDERS
    // --------------------------------------------------------

    const status =
      String(order.status).toLowerCase();

    if (
      status === "delivered" ||
      status === "cancelled"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This order cannot be assigned.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // DETERMINE AGENT
    // --------------------------------------------------------

    let selectedAgent: Agent | null =
      null;

    let distanceKm: number | null =
      null;

    let assignmentMethod:
      | "gps"
      | "zone"
      | "manual"
      | "fallback" = "manual";

    // --------------------------------------------------------
    // DELIVERY AGENT CLAIMING ORDER
    // --------------------------------------------------------

    if (isDeliveryAgent) {
      if (
        requestedAgentId &&
        requestedAgentId !== user.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A delivery agent can only assign an order to themselves.",
          },
          { status: 403 }
        );
      }

      if (
        order.assigned_agent_id &&
        order.assigned_agent_id !== user.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This order is already assigned to another agent.",
          },
          { status: 409 }
        );
      }

      const {
        data: ownAgent,
        error: ownAgentError,
      } =
        await adminSupabase
          .from("profiles")
          .select(
            `
              id,
              full_name,
              role,
              zone_id,
              is_available,
              current_latitude,
              current_longitude
            `
          )
          .eq("id", user.id)
          .eq(
            "role",
            "delivery_agent"
          )
          .single();

      if (
        ownAgentError ||
        !ownAgent
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Delivery agent profile not found.",
          },
          { status: 404 }
        );
      }

      selectedAgent =
        ownAgent as Agent;

      assignmentMethod =
        "manual";
    }

    // --------------------------------------------------------
    // ADMIN MANUAL ASSIGNMENT
    // --------------------------------------------------------

    if (
      isAdmin &&
      requestedAgentId &&
      !autoAssign
    ) {
      const {
        data: manualAgent,
        error: manualAgentError,
      } =
        await adminSupabase
          .from("profiles")
          .select(
            `
              id,
              full_name,
              role,
              zone_id,
              is_available,
              current_latitude,
              current_longitude
            `
          )
          .eq(
            "id",
            requestedAgentId
          )
          .eq(
            "role",
            "delivery_agent"
          )
          .single();

      if (
        manualAgentError ||
        !manualAgent
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected delivery agent was not found.",
          },
          { status: 404 }
        );
      }

      selectedAgent =
        manualAgent as Agent;

      assignmentMethod =
        "manual";
    }

    // --------------------------------------------------------
    // ADMIN AUTO ASSIGN
    // --------------------------------------------------------

    if (
      isAdmin &&
      autoAssign
    ) {
      const result =
        await findNearestAvailableAgent(
          adminSupabase,
          order.delivery_latitude !==
            null
            ? Number(
                order.delivery_latitude
              )
            : null,
          order.delivery_longitude !==
            null
            ? Number(
                order.delivery_longitude
              )
            : null,
          order.delivery_zone_id ?? null
        );

      if (!result) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No available delivery agent found.",
          },
          { status: 409 }
        );
      }

      selectedAgent =
        result.agent as Agent;

      distanceKm =
        result.distanceKm;

      assignmentMethod =
        result.method;
    }

    // --------------------------------------------------------
    // NO AGENT SPECIFIED
    // --------------------------------------------------------

    if (!selectedAgent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Provide an agentId or set autoAssign to true.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // ASSIGN ORDER
    // --------------------------------------------------------

    const {
      data: updatedOrder,
      error: updateError,
    } =
      await adminSupabase
        .from("orders")
        .update({
          assigned_agent_id:
            selectedAgent.id,
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

    if (
      updateError ||
      !updatedOrder
    ) {
      console.error(
        "Order assignment update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to assign delivery agent.",
          details:
            updateError?.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // MARK AGENT UNAVAILABLE
    // --------------------------------------------------------

    const {
      error: availabilityError,
    } =
      await adminSupabase
        .from("profiles")
        .update({
          is_available: false,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          selectedAgent.id
        );

    if (availabilityError) {
      console.error(
        "Agent availability update error:",
        availabilityError
      );
    }

    // --------------------------------------------------------
    // TRACKING EVENT
    // --------------------------------------------------------

    const {
      error: trackingError,
    } =
      await adminSupabase
        .from("tracking_events")
        .insert({
          order_id: orderId,
          status: "assigned",
          actor_id: user.id,
          description:
            assignmentMethod ===
            "gps"
              ? `Automatically assigned to ${selectedAgent.full_name ?? "delivery agent"} using nearest GPS location.`
              : assignmentMethod ===
                "zone"
                ? `Automatically assigned to ${selectedAgent.full_name ?? "delivery agent"} using delivery zone.`
                : assignmentMethod ===
                  "fallback"
                  ? `Automatically assigned to ${selectedAgent.full_name ?? "delivery agent"} using available-agent fallback.`
                  : `Order assigned to ${selectedAgent.full_name ?? "delivery agent"}.`,
        });

    if (trackingError) {
      console.error(
        "Assignment tracking event error:",
        trackingError
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Delivery agent assigned successfully.",
        order: updatedOrder,
        agent: selectedAgent,
        assignment: {
          method: assignmentMethod,
          distanceKm,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Assignment API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
