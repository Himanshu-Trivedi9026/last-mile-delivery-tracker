import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    adminSupabase: createAdminClient(),
  };
}

// ============================================================
// UPDATE RATE CARD
// ============================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ rateCardId: string }>;
  }
) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { adminSupabase } = auth;
    const { rateCardId } = await context.params;

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.rate_type !== undefined) {
      if (!["intra", "inter"].includes(body.rate_type)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid rate type.",
          },
          { status: 400 }
        );
      }

      updateData.rate_type = body.rate_type;
    }

    if (body.order_type !== undefined) {
      if (!["B2B", "B2C"].includes(body.order_type)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid order type.",
          },
          { status: 400 }
        );
      }

      updateData.order_type = body.order_type;
    }

    for (const field of [
      "base_rate",
      "per_kg_rate",
      "cod_surcharge",
    ]) {
      if (body[field] !== undefined) {
        const value = Number(body[field]);

        if (!Number.isFinite(value) || value < 0) {
          return NextResponse.json(
            {
              success: false,
              error: `${field} must be a valid non-negative number.`,
            },
            { status: 400 }
          );
        }

        updateData[field] = value;
      }
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid fields supplied for update.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from("rate_cards")
      .update(updateData)
      .eq("id", rateCardId)
      .select()
      .single();

    if (error) {
      console.error("Rate card PATCH error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update rate card.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Rate card updated successfully.",
        rateCard: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected rate card PATCH error:", error);

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
// DELETE RATE CARD
// ============================================================

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ rateCardId: string }>;
  }
) {
  try {
    const auth = await requireAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { adminSupabase } = auth;
    const { rateCardId } = await context.params;

    const { error } = await adminSupabase
      .from("rate_cards")
      .delete()
      .eq("id", rateCardId);

    if (error) {
      console.error("Rate card DELETE error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete rate card.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Rate card deleted successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected rate card DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
