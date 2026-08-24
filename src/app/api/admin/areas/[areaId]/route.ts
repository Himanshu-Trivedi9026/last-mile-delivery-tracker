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

// PATCH /api/admin/areas/[areaId]
export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ areaId: string }>;
  }
) {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    const { areaId } = await params;

    if (!areaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Area ID is required.",
        },
        { status: 400 }
      );
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
        .neq("id", areaId)
        .maybeSingle();

    if (duplicateError) {
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
          error: "Another area with this name already exists.",
        },
        { status: 409 }
      );
    }

    const { data: area, error } = await adminSupabase
      .from("areas")
      .update({
        name,
        zone_id: zoneId,
      })
      .eq("id", areaId)
      .select(
        `
          id,
          name,
          zone_id,
          created_at
        `
      )
      .single();

    if (error || !area) {
      return NextResponse.json(
        {
          success: false,
          error: "Area not found or could not be updated.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Delivery area updated successfully.",
        area: {
          ...area,
          zone,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH area error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/areas/[areaId]
export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ areaId: string }>;
  }
) {
  try {
    const authError = await requireAdmin();

    if (authError) {
      return authError;
    }

    const { areaId } = await params;

    if (!areaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Area ID is required.",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: area, error: areaError } = await adminSupabase
      .from("areas")
      .select("id, name")
      .eq("id", areaId)
      .maybeSingle();

    if (areaError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to load delivery area.",
        },
        { status: 500 }
      );
    }

    if (!area) {
      return NextResponse.json(
        {
          success: false,
          error: "Delivery area not found.",
        },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminSupabase
      .from("areas")
      .delete()
      .eq("id", areaId);

    if (deleteError) {
      console.error(
        "Area deletion error:",
        deleteError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Area could not be deleted. It may be referenced by existing data.",
          details: deleteError.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Delivery area deleted successfully.",
        area,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE area error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
