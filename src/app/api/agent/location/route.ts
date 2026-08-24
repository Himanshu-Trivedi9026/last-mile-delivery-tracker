import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LocationPayload = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
};

export async function POST(request: Request) {
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
      console.error("Agent location authentication error:", userError);

      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    console.log(
      "Agent location request from user:",
      user.id
    );

    // ============================================================
    // 2. Verify delivery-agent role
    // ============================================================

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      console.error(
        "Agent profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error: "User profile could not be loaded.",
          details:
            profileError?.message ?? null,
        },
        { status: 500 }
      );
    }

    console.log(
      "Authenticated agent profile:",
      profile
    );

    if (profile.role !== "delivery_agent") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only delivery agents can update their location.",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 3. Read request body
    // ============================================================

    let body: LocationPayload;

    try {
      body =
        (await request.json()) as LocationPayload;
    } catch (error) {
      console.error(
        "Agent location JSON parsing error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    const accuracy =
      body.accuracy === undefined ||
      body.accuracy === null
        ? null
        : Number(body.accuracy);

    console.log("Received location payload:", {
      latitude,
      longitude,
      accuracy,
    });

    // ============================================================
    // 4. Validate coordinates
    // ============================================================

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid latitude.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid longitude.",
        },
        { status: 400 }
      );
    }

    if (
      accuracy !== null &&
      (!Number.isFinite(accuracy) || accuracy < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid GPS accuracy.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 5. Create admin Supabase client
    // ============================================================

    const adminSupabase = createAdminClient();

    // ============================================================
    // 6. Verify the target agent exists using admin client
    // ============================================================

    const {
      data: existingAgent,
      error: existingAgentError,
    } = await adminSupabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          role,
          current_latitude,
          current_longitude,
          updated_at
        `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (existingAgentError) {
      console.error(
        "Existing agent lookup error:",
        existingAgentError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify agent profile.",
          details: existingAgentError.message,
          code: existingAgentError.code,
          hint: existingAgentError.hint ?? null,
        },
        { status: 500 }
      );
    }

    if (!existingAgent) {
      console.error(
        "Agent profile not found for user:",
        user.id
      );

      return NextResponse.json(
        {
          success: false,
          error: "Agent profile not found.",
          user_id: user.id,
        },
        { status: 404 }
      );
    }

    console.log(
      "Existing agent found:",
      existingAgent
    );

    if (existingAgent.role !== "delivery_agent") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authenticated profile is not a delivery agent.",
          role: existingAgent.role,
        },
        { status: 403 }
      );
    }

    // ============================================================
    // 7. Update agent location
    // ============================================================

    const updatePayload = {
      current_latitude: latitude,
      current_longitude: longitude,
      updated_at: new Date().toISOString(),
    };

    console.log(
      "Updating agent location with:",
      updatePayload
    );

    const {
      data: updatedProfile,
      error: updateError,
    } = await adminSupabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select(
        `
          id,
          full_name,
          role,
          current_latitude,
          current_longitude,
          updated_at
        `
      )
      .maybeSingle();

    // ============================================================
    // 8. Handle Supabase update error
    // ============================================================

    if (updateError) {
      console.error(
        "=========================================="
      );
      console.error(
        "AGENT LOCATION SUPABASE UPDATE ERROR"
      );
      console.error(
        "message:",
        updateError.message
      );
      console.error(
        "code:",
        updateError.code
      );
      console.error(
        "details:",
        updateError.details
      );
      console.error(
        "hint:",
        updateError.hint
      );
      console.error(
        "=========================================="
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update agent location.",
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint ?? null,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 9. Verify update actually returned a profile
    // ============================================================

    if (!updatedProfile) {
      console.error(
        "Location update affected 0 profiles.",
        {
          userId: user.id,
          latitude,
          longitude,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Agent location update affected no profile.",
          user_id: user.id,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 10. Success
    // ============================================================

    console.log(
      "Agent location updated successfully:",
      updatedProfile
    );

    return NextResponse.json({
      success: true,
      message:
        "Agent location updated successfully.",
      location: {
        latitude:
          updatedProfile.current_latitude,
        longitude:
          updatedProfile.current_longitude,
        accuracy,
        updated_at:
          updatedProfile.updated_at,
      },
    });
  } catch (error) {
    console.error(
      "=========================================="
    );
    console.error(
      "AGENT LOCATION API UNEXPECTED ERROR"
    );
    console.error(error);
    console.error(
      "=========================================="
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}