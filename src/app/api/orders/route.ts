import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderSchema } from "@/validations/order";

// ============================================================
// TYPES
// ============================================================

type OrderType = "B2B" | "B2C";

type PaymentMethod =
  | "prepaid"
  | "cod";

type RateType =
  | "intra"
  | "inter";

// ============================================================
// ORDER NUMBER
// ============================================================

function generateOrderNumber() {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase();

  return `LM-${timestamp}-${random}`;
}

// ============================================================
// VOLUMETRIC WEIGHT
// ============================================================
//
// Formula:
//
// Length × Width × Height ÷ 5000
//
// Dimensions are in centimeters.
//
// ============================================================

function calculateVolumetricWeight(
  length: number,
  width: number,
  height: number
) {
  return (
    (length *
      width *
      height) /
    5000
  );
}

// ============================================================
// CHARGEABLE WEIGHT
// ============================================================
//
// Chargeable weight is the higher of:
//
// 1. Actual weight
// 2. Volumetric weight
//
// ============================================================

function calculateChargeableWeight(
  actualWeight: number,
  volumetricWeight: number
) {
  return Math.max(
    actualWeight,
    volumetricWeight
  );
}

// ============================================================
// ZONE DETECTION
// ============================================================
//
// Finds the configured delivery area from the address.
//
// Example:
//
// "VIT Bhopal University, Bhopal"
//
// can match:
//
// "VIT Bhopal University"
//
// The corresponding zone is then returned.
//
// ============================================================

async function detectZoneFromAddress(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
  address: string
) {
  const {
    data: areas,
    error,
  } = await adminSupabase
    .from("areas")
    .select(
      `
        id,
        name,
        zone_id,
        zones (
          id,
          name
        )
      `
    )
    .order("name", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Area lookup error:",
      error
    );

    throw new Error(
      "Failed to load delivery areas."
    );
  }

  if (
    !areas ||
    areas.length === 0
  ) {
    throw new Error(
      "No delivery areas are configured."
    );
  }

  const normalizedAddress =
    address
      .trim()
      .toLowerCase();

  // ----------------------------------------------------------
  // Find matching area
  // ----------------------------------------------------------
  //
  // Longest matching area wins.
  //
  // This prevents a generic area from being selected when a
  // more specific area exists.
  //
  // ----------------------------------------------------------

  const matchingArea =
    areas
      .filter((area) =>
        normalizedAddress.includes(
          area.name
            .trim()
            .toLowerCase()
        )
      )
      .sort(
        (a, b) =>
          b.name.length -
          a.name.length
      )[0];

  if (!matchingArea) {
    throw new Error(
      `Could not detect a delivery zone for address: ${address}`
    );
  }

  // ----------------------------------------------------------
  // Supabase relationship can return either an object or array
  // depending on the generated relationship shape.
  // ----------------------------------------------------------

  const zone =
    Array.isArray(
      matchingArea.zones
    )
      ? matchingArea.zones[0]
      : matchingArea.zones;

  if (!zone) {
    throw new Error(
      `Area "${matchingArea.name}" does not have a valid zone.`
    );
  }

  return {
    areaId:
      matchingArea.id,

    areaName:
      matchingArea.name,

    zoneId:
      zone.id,

    zoneName:
      zone.name,
  };
}

// ============================================================
// RATE CARD LOOKUP
// ============================================================
//
// rate_type:
//
//   intra = pickup and delivery are in the same zone
//   inter = pickup and delivery are in different zones
//
// order_type:
//
//   B2B
//   B2C
//
// ============================================================

async function getRateCard(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
  rateType: RateType,
  orderType: OrderType
) {
  const {
    data: rateCard,
    error,
  } =
    await adminSupabase
      .from("rate_cards")
      .select(
        `
          id,
          rate_type,
          order_type,
          base_rate,
          per_kg_rate,
          cod_surcharge,
          is_active
        `
      )
      .eq(
        "rate_type",
        rateType
      )
      .eq(
        "order_type",
        orderType
      )
      .eq(
        "is_active",
        true
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "Rate card lookup error:",
      error
    );

    throw new Error(
      "Failed to load the applicable rate card."
    );
  }

  if (!rateCard) {
    throw new Error(
      `No active ${rateType} rate card found for ${orderType}.`
    );
  }

  return rateCard;
}

// ============================================================
// DELIVERY CHARGE CALCULATION
// ============================================================
//
// Formula:
//
// Delivery Fee
// = Base Rate
// + (Chargeable Weight × Per KG Rate)
//
// COD:
//
// COD Surcharge is added only when payment method is COD.
//
// IMPORTANT:
// delivery_type is currently NOT included in the rate_cards
// table.
//
// Therefore pricing is determined by:
//
// zone type + order type + chargeable weight
//
// ============================================================

function calculateCharges(
  baseRate: number,
  perKgRate: number,
  codSurchargeRate: number,
  chargeableWeight: number,
  paymentMethod: PaymentMethod
) {
  const deliveryFee =
    Number(baseRate) +
    Number(perKgRate) *
      Number(chargeableWeight);

  const codSurcharge =
    paymentMethod === "cod"
      ? Number(
          codSurchargeRate
        )
      : 0;

  const totalDeliveryCharge =
    deliveryFee +
    codSurcharge;

  return {
    deliveryFee,
    codSurcharge,
    totalDeliveryCharge,
  };
}

// ============================================================
// DELIVERY AGENT ASSIGNMENT
// ============================================================
//
// Finds the first available delivery agent who:
//
// 1. Has role = delivery_agent
// 2. Belongs to the delivery zone
// 3. Is currently available
//
// If an agent is found:
//      status = assigned
//      assigned_agent_id = agent.id
//
// If no agent is available:
//      status = pending
//      assigned_agent_id = null
//
// ============================================================

async function findAvailableDeliveryAgent(
  adminSupabase: ReturnType<
    typeof createAdminClient
  >,
  deliveryZoneId: string
) {
  const {
    data: agent,
    error,
  } = await adminSupabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        role,
        zone_id,
        is_available
      `
    )
    .eq(
      "role",
      "delivery_agent"
    )
    .eq(
      "zone_id",
      deliveryZoneId
    )
    .eq(
      "is_available",
      true
    )
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Delivery agent lookup error:",
      error
    );

    throw new Error(
      "Failed to find an available delivery agent."
    );
  }

  return agent;
}

// ============================================================
// POST /api/orders
// CREATE ORDER
// ============================================================

export async function POST(
  request: Request
) {
  try {
    // ========================================================
    // 1. AUTHENTICATED USER CLIENT
    // ========================================================

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // 2. LOAD PROFILE
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "id, role"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User profile could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 3. CUSTOMER ONLY
    // ========================================================

    if (
      profile.role !==
      "customer"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only customers can create orders.",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 4. READ REQUEST BODY
    // ========================================================

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 5. VALIDATE REQUEST
    // ========================================================

    const validationResult =
      createOrderSchema.safeParse(
        body
      );

    if (
      !validationResult.success
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid order data.",
          details:
            validationResult.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 6. EXTRACT VALIDATED DATA
    // ========================================================

    const {
      pickupAddress,
      deliveryAddress,

      packageWeight,
      packageType,

      packageLength,
      packageWidth,
      packageHeight,

      orderType,

      deliveryType,
      paymentMethod,

      orderAmount,

      expectedDeliveryDate,
    } =
      validationResult.data;

    // ========================================================
    // 7. SERVER-SIDE ADMIN CLIENT
    // ========================================================
    //
    // Used only for:
    //
    // - areas
    // - zones
    // - rate_cards
    // - delivery agent lookup
    //
    // The service-role key never reaches the browser.
    //
    // ========================================================

    const adminSupabase =
      createAdminClient();

    // ========================================================
    // 8. DETECT PICKUP ZONE
    // ========================================================

    const pickupZone =
      await detectZoneFromAddress(
        adminSupabase,
        pickupAddress
      );

    // ========================================================
    // 9. DETECT DELIVERY ZONE
    // ========================================================

    const deliveryZone =
      await detectZoneFromAddress(
        adminSupabase,
        deliveryAddress
      );

    // ========================================================
    // 10. CALCULATE VOLUMETRIC WEIGHT
    // ========================================================

    const volumetricWeight =
      calculateVolumetricWeight(
        packageLength,
        packageWidth,
        packageHeight
      );

    // ========================================================
    // 11. CALCULATE CHARGEABLE WEIGHT
    // ========================================================

    const chargeableWeight =
      calculateChargeableWeight(
        packageWeight,
        volumetricWeight
      );

    // ========================================================
    // 12. DETERMINE INTRA / INTER
    // ========================================================

    const rateType: RateType =
      pickupZone.zoneId ===
      deliveryZone.zoneId
        ? "intra"
        : "inter";

    // ========================================================
    // 13. GET RATE CARD
    // ========================================================

    const rateCard =
      await getRateCard(
        adminSupabase,
        rateType,
        orderType
      );

    // ========================================================
    // 14. CALCULATE CHARGES
    // ========================================================

    const {
      deliveryFee,
      codSurcharge,
      totalDeliveryCharge,
    } =
      calculateCharges(
        Number(
          rateCard.base_rate
        ),
        Number(
          rateCard.per_kg_rate
        ),
        Number(
          rateCard.cod_surcharge
        ),
        chargeableWeight,
        paymentMethod
      );

    // ========================================================
    // 15. FIND AVAILABLE DELIVERY AGENT
    // ========================================================

    const availableAgent =
      await findAvailableDeliveryAgent(
        adminSupabase,
        deliveryZone.zoneId
      );

    const assignedAgentId =
      availableAgent?.id ?? null;

    const assignedAgentName =
      availableAgent?.full_name ??
      null;

    const initialOrderStatus =
      availableAgent
        ? "assigned"
        : "pending";

    console.log(
      "Agent assignment:",
      {
        deliveryZone:
          deliveryZone.zoneName,

        deliveryZoneId:
          deliveryZone.zoneId,

        agent:
          assignedAgentName,

        agentId:
          assignedAgentId,

        status:
          initialOrderStatus,
      }
    );

    // ========================================================
    // 16. GENERATE ORDER NUMBER
    // ========================================================

    const orderNumber =
      generateOrderNumber();

    // ========================================================
    // 17. CREATE ORDER
    // ========================================================

    const {
      data: order,
      error: orderError,
    } =
      await supabase
        .from("orders")
        .insert({
          // --------------------------------------------------
          // Basic order information
          // --------------------------------------------------

          order_number:
            orderNumber,

          customer_id:
            user.id,

          // --------------------------------------------------
          // Addresses
          // --------------------------------------------------

          pickup_address:
            pickupAddress,

          delivery_address:
            deliveryAddress,

          // --------------------------------------------------
          // Package
          // --------------------------------------------------

          package_weight:
            packageWeight,

          package_type:
            packageType,

          package_length:
            packageLength,

          package_width:
            packageWidth,

          package_height:
            packageHeight,

          volumetric_weight:
            volumetricWeight,

          chargeable_weight:
            chargeableWeight,

          // --------------------------------------------------
          // Order classification
          // --------------------------------------------------

          order_type:
            orderType,

          // --------------------------------------------------
          // Delivery
          // --------------------------------------------------

          delivery_type:
            deliveryType,

          // --------------------------------------------------
          // Payment
          // --------------------------------------------------

          payment_method:
            paymentMethod,

          order_amount:
            orderAmount,

          // --------------------------------------------------
          // Server-calculated pricing
          // --------------------------------------------------

          delivery_fee:
            deliveryFee,

          cod_surcharge:
            codSurcharge,

          // --------------------------------------------------
          // Status
          // --------------------------------------------------

          status:
            initialOrderStatus,

          // --------------------------------------------------
          // Agent
          // --------------------------------------------------

          assigned_agent_id:
            assignedAgentId,

          // --------------------------------------------------
          // Zones
          // --------------------------------------------------

          pickup_zone_id:
            pickupZone.zoneId,

          delivery_zone_id:
            deliveryZone.zoneId,

          // --------------------------------------------------
          // Expected delivery
          // --------------------------------------------------

          expected_delivery_date:
            expectedDeliveryDate ??
            null,
        })
        .select()
        .single();

    // ========================================================
    // 18. DATABASE ERROR
    // ========================================================

    if (orderError) {
      console.error(
        "Order creation error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to create order.",

          details:
            process.env.NODE_ENV ===
            "development"
              ? orderError.message
              : undefined,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 19. CREATE INITIAL TRACKING EVENT
    // ========================================================
    //
    // Create the first tracking event immediately after the order
    // is created. This keeps the customer tracking page in sync
    // with the order status from the beginning.
    //
    // ========================================================

    const trackingDescription =
      initialOrderStatus === "assigned"
        ? "Order assigned to delivery agent."
        : "Order created and waiting for delivery agent assignment.";

    const trackingLocation =
      initialOrderStatus === "assigned"
        ? "Bhopal"
        : deliveryZone.zoneName;

    const { error: trackingEventError } =
      await adminSupabase
        .from("tracking_events")
        .insert({
          order_id: order.id,
          status: initialOrderStatus,
          description: trackingDescription,
          location: trackingLocation,
          updated_by: assignedAgentId,
        });

    if (trackingEventError) {
      console.error(
        "Initial tracking event creation error:",
        trackingEventError
      );

      // The order itself was created successfully. Keep the order
      // response successful, but log the tracking failure so it can
      // be diagnosed without hiding a successfully created order.
    }

    // ========================================================
    // 20. RETURN SUCCESS
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Order created successfully.",

        order,

        // ----------------------------------------------------
        // Pricing information
        // ----------------------------------------------------

        pricing: {
          orderAmount:
            Number(
              Number(
                orderAmount
              ).toFixed(2)
            ),

          actualWeight:
            Number(
              Number(
                packageWeight
              ).toFixed(2)
            ),

          volumetricWeight:
            Number(
              Number(
                volumetricWeight
              ).toFixed(2)
            ),

          chargeableWeight:
            Number(
              Number(
                chargeableWeight
              ).toFixed(2)
            ),

          rateType,

          orderType,

          baseRate:
            Number(
              rateCard.base_rate
            ),

          perKgRate:
            Number(
              rateCard.per_kg_rate
            ),

          deliveryFee:
            Number(
              Number(
                deliveryFee
              ).toFixed(2)
            ),

          codSurcharge:
            Number(
              Number(
                codSurcharge
              ).toFixed(2)
            ),

          totalDeliveryCharge:
            Number(
              Number(
                totalDeliveryCharge
              ).toFixed(2)
            ),

          totalOrderValue:
            Number(
              (
                Number(
                  orderAmount
                ) +
                totalDeliveryCharge
              ).toFixed(2)
            ),
        },

        // ----------------------------------------------------
        // Zone information
        // ----------------------------------------------------

        zones: {
          pickup: {
            areaId:
              pickupZone.areaId,

            areaName:
              pickupZone.areaName,

            zoneId:
              pickupZone.zoneId,

            zoneName:
              pickupZone.zoneName,
          },

          delivery: {
            areaId:
              deliveryZone.areaId,

            areaName:
              deliveryZone.areaName,

            zoneId:
              deliveryZone.zoneId,

            zoneName:
              deliveryZone.zoneName,
          },
        },

        // ----------------------------------------------------
        // Agent assignment information
        // ----------------------------------------------------

        assignment: {
          status:
            initialOrderStatus,

          agentId:
            assignedAgentId,

          agentName:
            assignedAgentName,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    // ========================================================
    // GLOBAL ERROR HANDLER
    // ========================================================

    console.error(
      "Create order error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// GET /api/orders
// RETRIEVE ORDERS
// ============================================================

export async function GET() {
  try {
    // ========================================================
    // 1. AUTHENTICATION
    // ========================================================

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // 2. GET PROFILE
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "id, role"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User profile could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 3. GET ORDERS
    // ========================================================
    //
    // RLS determines which orders the authenticated user
    // is allowed to see.
    //
    // ========================================================

    const {
      data: orders,
      error: ordersError,
    } =
      await supabase
        .from("orders")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (ordersError) {
      console.error(
        "Order retrieval error:",
        ordersError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to retrieve orders.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 4. ENRICH ORDERS WITH DELIVERY AGENT NAME
    // ========================================================
    //
    // Orders store assigned_agent_id.
    // Agent names are stored in profiles.full_name.
    //
    // We fetch the required profiles in one query instead of
    // making one database request for every order.
    //
    // ========================================================

    const assignedAgentIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order) => order.assigned_agent_id)
          .filter(
            (id): id is string =>
              typeof id === "string" &&
              id.trim().length > 0
          )
      )
    );

    let agentNameById = new Map<string, string>();

    if (assignedAgentIds.length > 0) {
      const {
        data: agents,
        error: agentsError,
      } = await createAdminClient()
        .from("profiles")
        .select(
          "id, full_name, role"
        )
        .in(
          "id",
          assignedAgentIds
        )
        .eq(
          "role",
          "delivery_agent"
        );

      if (agentsError) {
        console.error(
          "Delivery agent profile lookup error:",
          agentsError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Failed to load delivery agent information.",
          },
          {
            status: 500,
          }
        );
      }

      agentNameById = new Map(
        (agents ?? []).map(
          (agent) => [
            agent.id,
            agent.full_name ||
              "Unnamed Agent",
          ]
        )
      );
    }

    const enrichedOrders =
      (orders ?? []).map(
        (order) => ({
          ...order,

          // Keep the original database field.
          assigned_agent_id:
            order.assigned_agent_id ?? null,

          // Add a convenient display field for dashboards.
          agent_name:
            order.assigned_agent_id
              ? agentNameById.get(
                  order.assigned_agent_id
                ) ?? "Unknown Agent"
              : null,
        })
      );

    // ========================================================
    // 5. RETURN ORDERS
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        role:
          profile.role,

        count:
          enrichedOrders.length,

        orders:
          enrichedOrders,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    // ========================================================
    // GLOBAL GET ERROR
    // ========================================================

    console.error(
      "Get orders error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}