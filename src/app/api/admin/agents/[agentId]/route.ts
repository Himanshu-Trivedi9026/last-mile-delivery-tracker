import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      agentId: string;
    }>;
  }
) {
  try {
    // ============================================================
    // 1. Authenticate current user
    // ============================================================

    const supabase = await createClient();

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
    // 2. Verify admin role
    // ============================================================

    const { data: profile, error: profileError } =
      await supabase
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

    if (profile.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only administrators can access delivery agent details.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. Get agent ID
    // ============================================================

    const { agentId } = await params;

    if (!agentId || !agentId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Delivery agent ID is required.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 4. Create admin Supabase client
    // ============================================================

    const adminSupabase = createAdminClient();

    // ============================================================
    // 5. Load delivery agent
    // ============================================================

    const { data: agent, error: agentError } =
      await adminSupabase
        .from("profiles")
        .select(
          `
            id,
            full_name,
            phone,
            role,
            zone_id,
            is_available,
            current_latitude,
            current_longitude,
            created_at,
            updated_at
          `
        )
        .eq("id", agentId)
        .eq("role", "delivery_agent")
        .maybeSingle();

    if (agentError) {
      console.error(
        "Delivery agent lookup error:",
        agentError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load delivery agent.",
        },
        { status: 500 }
      );
    }

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Delivery agent not found.",
        },
        { status: 404 }
      );
    }

    // ============================================================
    // 6. Load assigned orders
    // ============================================================

    const { data: orders, error: ordersError } =
      await adminSupabase
        .from("orders")
        .select(
          `
            id,
            order_number,
            pickup_address,
            delivery_address,
            status,
            expected_delivery_date,
            created_at,
            updated_at
          `
        )
        .eq("assigned_agent_id", agentId)
        .order("created_at", {
          ascending: false,
        });

    if (ordersError) {
      console.error(
        "Agent assigned orders lookup error:",
        ordersError
      );
    }

    const assignedOrders = orders ?? [];

    // ============================================================
    // 7. Calculate statistics
    // ============================================================

    const activeOrders = assignedOrders.filter(
      (order) => {
        const status = String(
          order.status
        ).toLowerCase();

        return ![
          "delivered",
          "cancelled",
          "failed",
        ].includes(status);
      }
    );

    const deliveredOrders =
      assignedOrders.filter(
        (order) =>
          String(order.status).toLowerCase() ===
          "delivered"
      );

    const failedOrders =
      assignedOrders.filter(
        (order) =>
          String(order.status).toLowerCase() ===
          "failed"
      );

    // ============================================================
    // 8. Return agent information
    // ============================================================

    return NextResponse.json({
      success: true,

      agent: {
        ...agent,

        assigned_order_count:
          assignedOrders.length,

        active_order_count:
          activeOrders.length,

        delivered_order_count:
          deliveredOrders.length,

        failed_order_count:
          failedOrders.length,
      },

      orders: assignedOrders,

      count: assignedOrders.length,
    });
  } catch (error) {
    console.error(
      "Admin delivery agent details API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
