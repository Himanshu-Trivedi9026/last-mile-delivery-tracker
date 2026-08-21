import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/validations/order";

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 8).toUpperCase();

  return `LM-${timestamp}-${random}`;
}

// ============================================================
// POST /api/orders
// Create a new order
// ============================================================

export async function POST(request: Request) {
  try {
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

    // 2. Verify that the user is a customer
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

    if (profile.role !== "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Only customers can create orders.",
        },
        { status: 403 }
      );
    }

    // 3. Read request body
    const body = await request.json();

    // 4. Validate request
    const validationResult = createOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order data",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      pickupAddress,
      deliveryAddress,
      packageWeight,
      packageType,
      deliveryType,
      paymentMethod,
      orderAmount,
      deliveryFee,
      codSurcharge,
      expectedDeliveryDate,
    } = validationResult.data;

    // 5. Generate server-controlled order number
    const orderNumber = generateOrderNumber();

    // 6. Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
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
        expected_delivery_date: expectedDeliveryDate ?? null,
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create order.",
        },
        { status: 500 }
      );
    }

    // 7. Return created order
    return NextResponse.json(
      {
        success: true,
        message: "Order created successfully.",
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create order error:", error);

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
// GET /api/orders
// Retrieve orders based on the authenticated user's role
// ============================================================

export async function GET() {
  try {
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

    // 2. Get the user's profile and role
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

    // 3. Retrieve orders
    //
    // We intentionally don't manually filter the orders here.
    // Supabase RLS determines which rows this authenticated
    // user is allowed to see.
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Order retrieval error:", ordersError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to retrieve orders.",
        },
        { status: 500 }
      );
    }

    // 4. Return orders
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
    console.error("Get orders error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}