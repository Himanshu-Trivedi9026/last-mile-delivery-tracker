import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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

    const {
      data: profile,
      error: profileError,
    } = await supabase
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
            "Only administrators can access delivery agents.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. Admin client
    // ============================================================

    const adminSupabase = createAdminClient();

    // ============================================================
    // 4. Load delivery agents
    // ============================================================

    const {
      data: agents,
      error: agentsError,
    } = await adminSupabase
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
      .eq("role", "delivery_agent")
      .order("full_name", {
        ascending: true,
      });

    if (agentsError) {
      console.error(
        "Delivery agents lookup error:",
        agentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load delivery agents.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 5. Load assigned order counts
    // ============================================================

    const {
      data: orders,
      error: ordersError,
    } = await adminSupabase
      .from("orders")
      .select("assigned_agent_id")
      .not("assigned_agent_id", "is", null);

    if (ordersError) {
      console.error(
        "Agent order count lookup error:",
        ordersError
      );
    }

    const orderCounts =
      new Map<string, number>();

    for (const order of orders ?? []) {
      if (!order.assigned_agent_id) {
        continue;
      }

      orderCounts.set(
        order.assigned_agent_id,
        (orderCounts.get(
          order.assigned_agent_id
        ) ?? 0) + 1
      );
    }

    // ============================================================
    // 6. Attach order counts
    // ============================================================

    const enrichedAgents =
      (agents ?? []).map((agent) => ({
        ...agent,
        assigned_order_count:
          orderCounts.get(agent.id) ?? 0,
      }));

    return NextResponse.json({
      success: true,
      agents: enrichedAgents,
    });
  } catch (error) {
    console.error(
      "Admin delivery agents API error:",
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

export async function POST(
  request: Request
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

    const {
      data: profile,
      error: profileError,
    } = await supabase
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
            "Only administrators can create delivery agents.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. Read request
    // ============================================================

    const body = await request.json();

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const zoneId =
      typeof body.zoneId === "string" &&
      body.zoneId.trim()
        ? body.zoneId.trim()
        : null;

    const isAvailable =
      typeof body.isAvailable === "boolean"
        ? body.isAvailable
        : true;

    // ============================================================
    // 4. Validate
    // ============================================================

    if (!fullName) {
      return NextResponse.json(
        {
          success: false,
          error: "Full name is required.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email is required.",
        },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password must be at least 6 characters.",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number is required.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 5. Admin Supabase client
    // ============================================================

    const adminSupabase =
      createAdminClient();

    // ============================================================
    // 6. Validate selected zone
    // ============================================================

    if (zoneId) {
      const {
        data: zone,
        error: zoneError,
      } = await adminSupabase
        .from("zones")
        .select("id")
        .eq("id", zoneId)
        .single();

      if (zoneError || !zone) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected zone does not exist.",
          },
          { status: 400 }
        );
      }
    }

    // ============================================================
    // 7. Create Supabase Auth user
    //
    // The database trigger:
    // on_auth_user_created
    //
    // automatically creates the profiles row and copies:
    // full_name + phone from user metadata.
    // ============================================================

    const {
      data: authData,
      error: authError,
    } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,

        email_confirm: true,

        user_metadata: {
          full_name: fullName,
          phone,
        },
      });

    if (authError || !authData.user) {
      console.error(
        "Delivery agent Auth creation error:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            authError?.message ??
            "Failed to create delivery agent account.",
        },
        { status: 400 }
      );
    }

    const agentId =
      authData.user.id;

    // ============================================================
    // 8. Update automatically-created profile
    // ============================================================

    const {
      data: agentProfile,
      error: profileUpdateError,
    } =
      await adminSupabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          role: "delivery_agent",
          zone_id: zoneId,
          is_available: isAvailable,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", agentId)
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
        .single();

    if (
      profileUpdateError ||
      !agentProfile
    ) {
      console.error(
        "Delivery agent profile update error:",
        profileUpdateError
      );

      // Roll back Auth user if profile update fails.
      await adminSupabase.auth.admin.deleteUser(
        agentId
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Agent account was created but the delivery-agent profile could not be configured.",
          details:
            profileUpdateError?.message ??
            null,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 9. Success
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        message:
          "Delivery agent created successfully.",
        agent: {
          ...agentProfile,
          assigned_order_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create delivery agent API error:",
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