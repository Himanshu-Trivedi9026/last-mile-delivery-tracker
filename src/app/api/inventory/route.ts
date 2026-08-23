import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
// ============================================================
// Allowed inventory statuses
// ============================================================

const ALLOWED_STATUSES = [
  "received",
  "stored",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

// ============================================================
// GET /api/inventory
// ============================================================

export async function GET() {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // 1. Authentication
    // ----------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("========== GET INVENTORY AUTH DEBUG ==========");
    console.log("USER ID:", user?.id);
    console.log("USER EMAIL:", user?.email);
    console.log("AUTH ERROR:", userError);
    console.log("==============================================");

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // 2. Get profile
    // ----------------------------------------------------------

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 3. Authorization
    // ----------------------------------------------------------

    if (
      profile.role !== "delivery_agent" &&
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to access inventory.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // 4. Get inventory
    // ----------------------------------------------------------

    let query = supabase
      .from("inventory")
      .select("*")
      .order("received_at", { ascending: false });

    if (profile.role === "delivery_agent") {
      query = query.eq("assigned_agent_id", user.id);
    }

    const { data: inventory, error: inventoryError } = await query;

    if (inventoryError) {
      console.error("Inventory query error:", inventoryError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load inventory.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        inventory: inventory ?? [],
        count: inventory?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET inventory error:", error);

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
// POST /api/inventory
// Create inventory record
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // 1. Authentication
    // ----------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("");
    console.log("==============================================");
    console.log("     INVENTORY POST AUTH DEBUG");
    console.log("==============================================");
    console.log("USER ID:", user?.id);
    console.log("USER EMAIL:", user?.email);
    console.log("AUTH ERROR:", userError);
    console.log("==============================================");

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // 2. Get profile
    // ----------------------------------------------------------

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    console.log("PROFILE ID:", profile?.id);
    console.log("PROFILE ROLE:", profile?.role);
    console.log("PROFILE ERROR:", profileError);

    if (profileError || !profile) {
      console.error("Profile error:", profileError);

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 3. Authorization
    // ----------------------------------------------------------

    if (
      profile.role !== "delivery_agent" &&
      profile.role !== "admin"
    ) {
      console.log("UNAUTHORIZED ROLE:", profile.role);

      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to create inventory.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // 4. Parse request body
    // ----------------------------------------------------------

    let body: {
      order_id?: string;
      package_type?: string;
      weight?: number;
      current_location?: string;
      status?: string;
      assigned_agent_id?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    console.log("");
    console.log("========== INVENTORY REQUEST BODY ==========");
    console.log("ORDER ID:", body.order_id);
    console.log("PACKAGE TYPE:", body.package_type);
    console.log("WEIGHT:", body.weight);
    console.log("CURRENT LOCATION:", body.current_location);
    console.log("STATUS:", body.status);
    console.log("REQUESTED ASSIGNED AGENT:", body.assigned_agent_id);
    console.log("============================================");

    // ----------------------------------------------------------
    // 5. Validate order ID
    // ----------------------------------------------------------

    if (!body.order_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------
    // 6. Validate package type
    // ----------------------------------------------------------

    if (!body.package_type || !body.package_type.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Package type is required.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------
    // 7. Validate weight
    // ----------------------------------------------------------

    if (
      body.weight === undefined ||
      body.weight === null ||
      typeof body.weight !== "number" ||
      Number.isNaN(body.weight) ||
      body.weight <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Weight must be a positive number.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------
    // 8. Validate status
    // ----------------------------------------------------------

    const status = body.status ?? "received";

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------
    // 9. Determine assigned agent
    // ----------------------------------------------------------

    let assignedAgentId = body.assigned_agent_id ?? null;

    // Delivery agents can only create inventory
    // assigned to themselves.
    if (profile.role === "delivery_agent") {
      assignedAgentId = user.id;
    }

    console.log("");
    console.log("========== ASSIGNMENT DEBUG ==========");
    console.log("USER ID:", user.id);
    console.log("USER ROLE:", profile.role);
    console.log("FINAL ASSIGNED AGENT ID:", assignedAgentId);
    console.log("======================================");

    // ----------------------------------------------------------
    // 10. Verify order exists
    // ----------------------------------------------------------

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", body.order_id)
      .single();

    console.log("");
    console.log("========== ORDER DEBUG ==========");
    console.log("ORDER FOUND:", order?.id);
    console.log("ORDER ERROR:", orderError);
    console.log("=================================");

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: "The specified order does not exist.",
        },
        { status: 404 }
      );
    }

    // ----------------------------------------------------------
// 11. Create inventory record
// ----------------------------------------------------------

const inventoryPayload = {
  order_id: body.order_id,
  package_type: body.package_type.trim(),
  weight: body.weight,
  current_location: body.current_location?.trim() || null,
  status,
  assigned_agent_id: assignedAgentId,
};

console.log("");
console.log("========== INVENTORY INSERT DEBUG ==========");
console.log("INSERT PAYLOAD:");
console.log(JSON.stringify(inventoryPayload, null, 2));
console.log("============================================");

// ----------------------------------------------------------
// Use service-role client for the server-side mutation.
// Authentication and authorization have already been
// performed above using the authenticated client.
// ----------------------------------------------------------
console.log(
  "SERVICE ROLE KEY LOADED:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

const adminSupabase = createAdminClient();

const { data: inventoryItem, error: insertError } =
  await adminSupabase
    .from("inventory")
    .insert(inventoryPayload)
    .select("*")
    .single();

console.log("");
console.log("========== INSERT RESULT ==========");
console.log("INSERT ERROR:", insertError);
console.log("===================================");

if (insertError) {
  console.error("Inventory insert error:", insertError);

  return NextResponse.json(
    {
      success: false,
      error: "Failed to create inventory record.",
      details: insertError.message,
      code: insertError.code,
    },
    { status: 500 }
  );
}

// ----------------------------------------------------------
// 12. Return success
// ----------------------------------------------------------

console.log("========== INVENTORY INSERT SUCCESS ==========");

return NextResponse.json(
  {
    success: true,
    message: "Inventory record created successfully.",
    inventory: inventoryItem,
  },
  { status: 201 }
);
  } catch (error) {
    console.error("POST inventory error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}