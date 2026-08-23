import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();

    // ============================================================
    // 1. Check authentication
    // ============================================================

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

    // ============================================================
    // 2. Get order ID from dynamic route
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
    // 3. Get logged-in user's profile
    // ============================================================

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

    // ============================================================
    // 4. Get order from Supabase
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
    // 5. Customer authorization
    // ============================================================

    if (
      profile.role === "customer" &&
      order.customer_id !== user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not allowed to view this order.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 6. Return order
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        order,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get single order error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}