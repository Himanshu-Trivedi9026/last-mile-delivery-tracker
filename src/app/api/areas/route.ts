import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/validations/order";

// ============================================================
// Generate unique order number
// ============================================================

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();

  const random = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `LM-${timestamp}-${random}`;
}

// ============================================================
// Calculate delivery fee
// ============================================================

function calculateDeliveryFee(
  deliveryType: "standard" | "express",
  packageWeight: number
): number {
  let fee = deliveryType === "express" ? 150 : 80;

  if (packageWeight > 5) {
    fee += Math.ceil(packageWeight - 5) * 20;
  }

  return fee;
}

// ============================================================
// Calculate COD surcharge
// ============================================================

function calculateCodSurcharge(
  paymentMethod: "prepaid" | "cod"
): number {
  return paymentMethod === "cod" ? 30 : 0;
}

// ============================================================
// POST /api/orders
// Create a new order
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // 1. Authenticate user
    // ----------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Authentication error:", authError);

      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed.",
          details: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // 2. Load user profile
    // ----------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile query error:", profileError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load user profile.",
          details: profileError.message,
          code: profileError.code,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "User profile does not exist.",
        },
        { status: 404 }
      );
    }

    // ----------------------------------------------------------
    // 3. Verify customer role
    // ----------------------------------------------------------

    if (profile.role !== "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Only customers can create orders.",
          role: profile.role,
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // 4. Read request body
    // ----------------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch (error) {
      console.error("Invalid JSON body:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    console.log("Create order request body:", body);

    // ----------------------------------------------------------
    // 5. Validate request body
    // ----------------------------------------------------------

    const validationResult =
      createOrderSchema.safeParse(body);

    if (!validationResult.success) {
      const validationErrors =
        validationResult.error.flatten()
          .fieldErrors;

      console.error(
        "Order validation error:",
        validationErrors
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid order data.",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------
    // 6. Extract validated data
    // ----------------------------------------------------------

    const {
      pickupAddress,
      deliveryAddress,
      packageWeight,
      packageType,
      deliveryType,
      paymentMethod,
      orderAmount,
      expectedDeliveryDate,
    } = validationResult.data;

    // ----------------------------------------------------------
    // 7. Calculate server-side fees
    // ----------------------------------------------------------

    const deliveryFee = calculateDeliveryFee(
      deliveryType,
      packageWeight
    );

    const codSurcharge =
      calculateCodSurcharge(paymentMethod);

    // ----------------------------------------------------------
    // 8. Generate order number
    // ----------------------------------------------------------

    const orderNumber =
      generateOrderNumber();

    // ----------------------------------------------------------
    // 9. Prepare database record
    // ----------------------------------------------------------

    const orderData = {
      order_number: orderNumber,
      customer_id: user.id,

      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,

      package_weight: packageWeight,
      package_type: packageType,

      delivery_type: deliveryType,
      payment_method: paymentMethod,

      order_amount: orderAmount,
      delivery_fee: deliveryFee,
      cod_surcharge: codSurcharge,

      status: "pending",

      assigned_agent_id: null,

      expected_delivery_date:
        expectedDeliveryDate ?? null,
    };

    console.log(
      "Attempting order insert:",
      orderData
    );

    // ----------------------------------------------------------
    // 10. Insert order
    // ----------------------------------------------------------

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .insert(orderData)
      .select("*")
      .single();

    // ----------------------------------------------------------
    // 11. Handle database error
    // ----------------------------------------------------------

    if (orderError) {
      console.error(
        "===================================="
      );

      console.error(
        "ORDER CREATION DATABASE ERROR"
      );

      console.error(
        "Message:",
        orderError.message
      );

      console.error(
        "Code:",
        orderError.code
      );

      console.error(
        "Details:",
        orderError.details
      );

      console.error(
        "Hint:",
        orderError.hint
      );

      console.error(
        "===================================="
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create order.",
          details: orderError.message,
          code: orderError.code,
          hint: orderError.hint ?? null,
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 12. Verify returned order
    // ----------------------------------------------------------

    if (!order) {
      console.error(
        "Order insert succeeded but no order was returned."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Order may have been created, but no order data was returned.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 13. Success
    // ----------------------------------------------------------

    console.log(
      "Order created successfully:",
      order
    );

    return NextResponse.json(
      {
        success: true,
        message: "Order created successfully.",
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    // ----------------------------------------------------------
    // Unexpected server error
    // ----------------------------------------------------------

    console.error(
      "===================================="
    );

    console.error(
      "UNEXPECTED ORDER API ERROR"
    );

    console.error(error);

    console.error(
      "===================================="
    );

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/orders
// Retrieve orders for authenticated user
// ============================================================

export async function GET() {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // 1. Authenticate user
    // ----------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "GET /api/orders authentication error:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed.",
          details: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // 2. Get user profile
    // ----------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "GET /api/orders profile error:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load user profile.",
          details: profileError.message,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "User profile does not exist.",
        },
        { status: 404 }
      );
    }

    // ----------------------------------------------------------
    // 3. Retrieve orders
    // ----------------------------------------------------------

    const {
      data: orders,
      error: ordersError,
    } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (ordersError) {
      console.error(
        "GET /api/orders database error:",
        ordersError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to retrieve orders.",
          details: ordersError.message,
          code: ordersError.code,
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 4. Success
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        role: profile.role,
        count: orders?.length ?? 0,
        orders: orders ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET /api/orders unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}