import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ agentId: string }>;
  }
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Authenticate current user
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Use service-role client for admin data access
    // --------------------------------------------------------

    const adminSupabase = createAdminClient();

    // --------------------------------------------------------
    // Verify requested agent exists
    // --------------------------------------------------------

    const {
      data: agent,
      error: agentError,
    } = await adminSupabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          phone,
          role,
          zone_id,
          is_available
        `
      )
      .eq("id", agentId)
      .eq("role", "delivery_agent")
      .maybeSingle();

    if (agentError) {
      console.error(
        "Agent lookup error:",
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

    // --------------------------------------------------------
    // Get orders assigned to this agent
    // --------------------------------------------------------

    const {
      data: orders,
      error: ordersError,
    } = await adminSupabase
      .from("orders")
      .select("*")
      .eq("assigned_agent_id", agentId)
      .order("created_at", {
        ascending: false,
      });

    if (ordersError) {
      console.error(
        "Assigned orders lookup error:",
        ordersError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load assigned deliveries.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        agent,
        orders: orders ?? [],
        count: orders?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Assigned agent orders error:",
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
