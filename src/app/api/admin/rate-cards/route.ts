import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateType = "intra" | "inter";
type OrderType = "B2B" | "B2C";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
        },
        { status: 500 }
      ),
    };
  }

  if (profile.role !== "admin") {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Admin access required.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    adminSupabase: createAdminClient(),
  };
}

// ============================================================
// GET RATE CARDS
// ============================================================

export async function GET() {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { adminSupabase } = auth;

    const { data, error } = await adminSupabase
      .from("rate_cards")
      .select(
        `
          id,
          rate_type,
          order_type,
          base_rate,
          per_kg_rate,
          cod_surcharge,
          is_active,
          created_at,
          updated_at
        `
      )
      .order("rate_type", { ascending: true })
      .order("order_type", { ascending: true });

    if (error) {
      console.error("Rate cards GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load rate cards.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        rateCards: data ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected rate cards GET error:", error);

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
// CREATE RATE CARD
// ============================================================

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { adminSupabase } = auth;

    const body = await request.json();

    const rateType = body.rate_type as RateType;
    const orderType = body.order_type as OrderType;

    const baseRate = Number(body.base_rate);
    const perKgRate = Number(body.per_kg_rate);
    const codSurcharge = Number(body.cod_surcharge);
    const isActive = body.is_active !== false;

    if (!["intra", "inter"].includes(rateType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid rate type.",
        },
        { status: 400 }
      );
    }

    if (!["B2B", "B2C"].includes(orderType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order type.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(baseRate) ||
      baseRate < 0 ||
      !Number.isFinite(perKgRate) ||
      perKgRate < 0 ||
      !Number.isFinite(codSurcharge) ||
      codSurcharge < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Rates must be valid non-negative numbers.",
        },
        { status: 400 }
      );
    }

    const { data: existing } = await adminSupabase
      .from("rate_cards")
      .select("id")
      .eq("rate_type", rateType)
      .eq("order_type", orderType)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A rate card already exists for this rate type and order type.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await adminSupabase
      .from("rate_cards")
      .insert({
        rate_type: rateType,
        order_type: orderType,
        base_rate: baseRate,
        per_kg_rate: perKgRate,
        cod_surcharge: codSurcharge,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) {
      console.error("Rate card POST error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create rate card.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Rate card created successfully.",
        rateCard: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected rate card POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
