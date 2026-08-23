import { NextRequest, NextResponse } from "next/server";

type RouteRequest = {
  start?: {
    lat?: number;
    lng?: number;
  };
  end?: {
    lat?: number;
    lng?: number;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as RouteRequest;

    const startLat = Number(body.start?.lat);
    const startLng = Number(body.start?.lng);
    const endLat = Number(body.end?.lat);
    const endLng = Number(body.end?.lng);

    if (
      !Number.isFinite(startLat) ||
      !Number.isFinite(startLng) ||
      !Number.isFinite(endLat) ||
      !Number.isFinite(endLng)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid route coordinates.",
        },
        {
          status: 400,
        }
      );
    }

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(osrmUrl, {
      headers: {
        "User-Agent":
          "Last-Mile-Delivery-Tracker/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "OSRM routing error:",
        response.status,
        response.statusText
      );

      return NextResponse.json(
        {
          success: false,
          error: "Routing service unavailable.",
        },
        {
          status: 502,
        }
      );
    }

    const data = await response.json();

    if (
      data.code !== "Ok" ||
      !data.routes?.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No road route found.",
        },
        {
          status: 404,
        }
      );
    }

    const route = data.routes[0];

    const coordinates =
      route.geometry?.coordinates ?? [];

    const leafletCoordinates =
      coordinates
        .filter(
          (point: unknown) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1]))
        )
        .map(
          (point: [number, number]) =>
            [
              Number(point[1]),
              Number(point[0]),
            ] as [number, number]
        );

    return NextResponse.json({
      success: true,
      route: {
        coordinates: leafletCoordinates,
        distanceMeters: Number(route.distance) || 0,
        durationSeconds: Number(route.duration) || 0,
      },
    });
  } catch (error) {
    console.error(
      "Route API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate route.",
      },
      {
        status: 500,
      }
    );
  }
}
