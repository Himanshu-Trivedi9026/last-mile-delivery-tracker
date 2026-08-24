import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
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

    const { data: profile, error: profileError } =
      await supabase
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

    const adminSupabase = createAdminClient();

    const {
      data: customers,
      error: customersError,
    } = await adminSupabase
      .from("profiles")
      .select(
        "id, full_name, phone"
      )
      .eq("role", "customer")
      .order("full_name", {
        ascending: true,
      });

    if (customersError) {
      console.error(
        "Admin customers lookup error:",
        customersError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load customers.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        customers: customers ?? [],
        count: customers?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Admin customers API error:",
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
