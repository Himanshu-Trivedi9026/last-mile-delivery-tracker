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
    return NextResponse.json(
      {
        success: false,
        error: "Not authenticated.",
      },
      { status: 401 }
    );
  }

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

  if (profile.role !== "admin") {
    return NextResponse.json(
      {
        success: false,
        error: "Administrator access required.",
      },
      { status: 403 }
    );
  }

  return null;
}

// GET /api/admin/areas
export async function GET() {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    const adminSupabase = createAdminClient();

    const { data: areas, error } = await adminSupabase
      .from("areas")
      .select(
        `
          id,
          name,
          zone_id,
          created_at,
          zones (
            id,
            name
          )
        `
      )
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error("Area loading error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load delivery areas.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        areas: areas ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET areas error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/areas
export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    let body: unknown;

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

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const input = body as {
      name?: unknown;
      zoneId?: unknown;
      zone_id?: unknown;
    };

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const zoneId =
      typeof input.zoneId === "string"
        ? input.zoneId.trim()
        : typeof input.zone_id === "string"
          ? input.zone_id.trim()
          : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Area name is required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error: "Area name must be 150 characters or less.",
        },
        { status: 400 }
      );
    }

    if (!zoneId) {
      return NextResponse.json(
        {
          success: false,
          error: "Zone is required.",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: zone, error: zoneError } = await adminSupabase
      .from("zones")
      .select("id, name")
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

    const { data: duplicateArea, error: duplicateError } =
      await adminSupabase
        .from("areas")
        .select("id")
        .ilike("name", name)
        .maybeSingle();

    if (duplicateError) {
      console.error(
        "Duplicate area check error:",
        duplicateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to validate the area name.",
        },
        { status: 500 }
      );
    }

    if (duplicateArea) {
      return NextResponse.json(
        {
          success: false,
          error: "An area with this name already exists.",
        },
        { status: 409 }
      );
    }

    const { data: area, error } = await adminSupabase
      .from("areas")
      .insert({
        name,
        zone_id: zoneId,
      })
      .select(
        `
          id,
          name,
          zone_id,
          created_at
        `
      )
      .single();

    if (error) {
      console.error("Area creation error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create delivery area.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Delivery area created successfully.",
        area: {
          ...area,
          zone,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST areas error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
