import { NextRequest, NextResponse } from "next/server";
import { seedInitialData } from "@/lib/seed-data";
import { buildDeterministicOrders } from "@/lib/analytics-utils";
import {
  getFastAnalyticsPage,
  primeAnalyticsCache,
} from "@/lib/analytics-cache";

// Co-locate the serverless function with the Supabase pooler in us-west-2 (pdx1)
export const preferredRegion = ["pdx1", "sfo1", "iad1"];

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
      // Prime in-memory cache immediately and seed the DB asynchronously
      // so the response never exceeds 300ms even on an empty database.
      primeAnalyticsCache(buildDeterministicOrders(60));
      void seedInitialData(true).catch(() => {
        // Ignore background seed errors
      });
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
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
