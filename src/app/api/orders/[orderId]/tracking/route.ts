import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrackingEventSchema } from "@/validations/tracking";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

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

    // 1. Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // 2. Retrieve tracking events.
    // RLS determines whether this user can see them.
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

    return NextResponse.json(
      {
        success: true,
        orderId,
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

    // 1. Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // 2. Verify that the order exists
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, assigned_agent_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    // 3. Get user's profile and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // 4. Only admins or the assigned delivery agent
    // can create tracking events.
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

    // 5. Read request body
    const body = await request.json();

    // 6. Validate request
    const validationResult =
      createTrackingEventSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tracking event data.",
          details:
            validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      status,
      description,
      location,
    } = validationResult.data;

    // 7. Create tracking event
    const { data: event, error: eventError } = await supabase
      .from("tracking_events")
      .insert({
        order_id: orderId,
        status,
        description: description ?? null,
        location: location ?? null,
        updated_by: user.id,
      })
      .select()
      .single();

    if (eventError) {
      console.error(
        "Tracking event creation error:",
        eventError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create tracking event.",
        },
        { status: 500 }
      );
    }

    // 8. Synchronize the order's current status
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderError) {
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
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Tracking event created successfully.",
        event,
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
