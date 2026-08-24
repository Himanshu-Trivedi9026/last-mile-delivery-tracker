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

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, role")
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
          error: "Administrator access required.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    user,
    profile,
  };
}

// ============================================================
// GET /api/admin/zones
// ============================================================

export async function GET() {
  try {
    const auth = await requireAdmin();

    if (auth.error) {
      return auth.error;
    }

    const adminSupabase = createAdminClient();

    const {
      data: zones,
      error,
    } = await adminSupabase
      .from("zones")
      .select(
        "id, name, description, created_at"
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Zone loading error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load zones.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        zones: zones ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET zones error:",
      error
    );

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
// POST /api/admin/zones
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const auth = await requireAdmin();

    if (auth.error) {
      return auth.error;
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
      description?: unknown;
    };

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const description =
      typeof input.description === "string"
        ? input.description.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Zone name is required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zone name must be 100 characters or less.",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const {
      data: existingZone,
      error: existingZoneError,
    } = await adminSupabase
      .from("zones")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (existingZoneError) {
      console.error(
        "Existing zone check error:",
        existingZoneError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to validate the zone name.",
        },
        { status: 500 }
      );
    }

    if (existingZone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A zone with this name already exists.",
        },
        { status: 409 }
      );
    }

    const {
      data: zone,
      error,
    } = await adminSupabase
      .from("zones")
      .insert({
        name,
        description:
          description || null,
      })
      .select(
        "id, name, description, created_at"
      )
      .single();

    if (error) {
      console.error(
        "Zone creation error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create zone.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Zone created successfully.",
        zone,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST zones error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}