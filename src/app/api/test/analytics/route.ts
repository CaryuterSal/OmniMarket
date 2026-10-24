import { NextRequest, NextResponse } from "next/server";
import { seedInitialData } from "@/lib/seed-data";
import { getFastAnalyticsPage } from "@/lib/analytics-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit =
      Number.isNaN(limitParam) || limitParam < 1
        ? 50
        : Math.min(limitParam, 200);

    let result = await getFastAnalyticsPage(page, limit);

    if (result.total === 0) {
      await seedInitialData(true);
      result = await getFastAnalyticsPage(page, limit);
    }

    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages,
          latencyMs,
        },
        metrics: result.metrics,
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${latencyMs}ms`,
          "X-Cache-Status": result.fromCache ? "HIT" : "MISS",
        },
      }
    );
  } catch (error) {
    console.error("Error in GET /api/test/analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
