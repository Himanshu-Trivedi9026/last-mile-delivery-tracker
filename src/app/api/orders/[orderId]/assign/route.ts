import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/orders/[orderId]/assign
//
// Assign a pending order to a delivery agent.
//
// Supported:
// 1. Admin can assign the order to any delivery agent.
// 2. Delivery agent can claim an unassigned pending order
//    for themselves.
//
// Body for admin:
// {
//   "agentId": "delivery-agent-user-id"
// }
//
// Body for delivery agent:
// {
//   "agentId": "their-own-user-id"
// }
//
// If agentId is omitted, the authenticated delivery agent
// will automatically be used.
// ============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();

    // ============================================================
    // 1. Authenticate user
    // ============================================================

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

    // ============================================================
    // 2. Get order ID
    // ============================================================

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

    // ============================================================
    // 3. Get current user's profile
    // ============================================================

    const { data: currentProfile, error: currentProfileError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

    if (currentProfileError || !currentProfile) {
      console.error(
        "Current profile lookup error:",
        currentProfileError
      );

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 4. Only admin and delivery agents can assign orders
    // ============================================================

    const allowedRoles = ["admin", "delivery_agent"];

    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only administrators and delivery agents can assign orders.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 5. Read request body
    // ============================================================

    let body: { agentId?: string } = {};

    try {
      body = await request.json();
    } catch {
      // Empty request body is allowed for delivery agents.
      body = {};
    }

    // ============================================================
    // 6. Determine target agent
    // ============================================================

    let targetAgentId = body.agentId?.trim();

    // A delivery agent without an agentId assigns the order
    // to themselves.
    if (!targetAgentId && currentProfile.role === "delivery_agent") {
      targetAgentId = user.id;
    }

    if (!targetAgentId) {
      return NextResponse.json(
        {
          success: false,
          error: "agentId is required.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 7. Delivery agents can only assign orders to themselves
    // ============================================================

    if (
      currentProfile.role === "delivery_agent" &&
      targetAgentId !== user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Delivery agents can only assign orders to themselves.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 8. Get the target agent's profile
    // ============================================================

    const { data: targetAgent, error: targetAgentError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", targetAgentId)
        .single();

    if (targetAgentError || !targetAgent) {
      console.error(
        "Target agent lookup error:",
        targetAgentError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Delivery agent not found.",
        },
        { status: 404 }
      );
    }

    // ============================================================
    // 9. Verify target user is a delivery agent
    // ============================================================

    if (targetAgent.role !== "delivery_agent") {
      return NextResponse.json(
        {
          success: false,
          error: "Selected user is not a delivery agent.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 10. Get the order
    // ============================================================

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
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

    // ============================================================
    // 11. Verify current order status
    // ============================================================

    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order cannot be assigned because its current status is "${order.status}".`,
        },
        { status: 409 }
      );
    }

    // ============================================================
    // 12. Verify order is not already assigned
    // ============================================================

    if (order.assigned_agent_id) {
      return NextResponse.json(
        {
          success: false,
          error: "This order is already assigned to a delivery agent.",
        },
        { status: 409 }
      );
    }

    // ============================================================
    // 13. Assign the order
    // ============================================================

    const { data: updatedOrder, error: updateOrderError } =
      await supabase
        .from("orders")
        .update({
          assigned_agent_id: targetAgentId,
          status: "assigned",
        })
        .eq("id", orderId)
        .eq("status", "pending")
        .is("assigned_agent_id", null)
        .select()
        .single();

    if (updateOrderError || !updatedOrder) {
      console.error(
        "Order assignment update error:",
        updateOrderError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to assign order. It may have already been assigned.",
        },
        { status: 409 }
      );
    }

    // ============================================================
    // 14. Create tracking event
    // ============================================================

    const { data: trackingEvent, error: trackingEventError } =
      await supabase
        .from("tracking_events")
        .insert({
          order_id: orderId,
          status: "assigned",
          description: "Order assigned to delivery agent.",
          location: order.pickup_address ?? "Bhopal",
          updated_by: user.id,
        })
        .select()
        .single();

    // ============================================================
    // 15. Roll back order assignment if tracking event fails
    // ============================================================

    if (trackingEventError || !trackingEvent) {
      console.error(
        "Tracking event creation error:",
        trackingEventError
      );

      // Try to restore the order to its previous state.
      const { error: rollbackError } = await supabase
        .from("orders")
        .update({
          assigned_agent_id: null,
          status: "pending",
        })
        .eq("id", orderId)
        .eq("assigned_agent_id", targetAgentId)
        .eq("status", "assigned");

      if (rollbackError) {
        console.error(
          "Assignment rollback error:",
          rollbackError
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Order assignment could not be completed because the tracking event could not be created.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 16. Success
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        message: "Order assigned successfully.",
        order: updatedOrder,
        trackingEvent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Order assignment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}