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

  const {
    data: profile,
    error: profileError,
  } = await supabase
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
// PATCH /api/admin/zones/[zoneId]
// ============================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      zoneId: string;
    }>;
  }
) {
  try {
    const auth = await requireAdmin();

    if (auth.error) {
      return auth.error;
    }

    const { zoneId } =
      await context.params;

    if (!zoneId) {
      return NextResponse.json(
        {
          success: false,
          error: "Zone ID is required.",
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
      data: duplicateZone,
      error: duplicateError,
    } = await adminSupabase
      .from("zones")
      .select("id")
      .ilike("name", name)
      .neq("id", zoneId)
      .maybeSingle();

    if (duplicateError) {
      console.error(
        "Duplicate zone check error:",
        duplicateError
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

    if (duplicateZone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Another zone with this name already exists.",
        },
        { status: 409 }
      );
    }

    const {
      data: zone,
      error,
    } = await adminSupabase
      .from("zones")
      .update({
        name,
        description:
          description || null,
      })
      .eq("id", zoneId)
      .select(
        "id, name, description, created_at"
      )
      .single();

    if (error || !zone) {
      console.error(
        "Zone update error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Zone not found or could not be updated.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Zone updated successfully.",
        zone,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PATCH zone error:",
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