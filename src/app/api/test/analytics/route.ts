import { NextRequest, NextResponse } from "next/server";
import { getFastAnalyticsPage } from "@/lib/analytics-cache";

// Use a single region string ("sfo1") so Vercel Hobby deploys directly in San Francisco
export const preferredRegion = "sfo1";

const routeModuleLoadedAt = Date.now();

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const requestReceivedAt = Date.now();
  const msSinceModuleLoad = requestReceivedAt - routeModuleLoadedAt;

  try {
    const tParse = performance.now();
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit =
      Number.isNaN(limitParam) || limitParam < 1
        ? 50
        : Math.min(limitParam, 200);
    const parseParamsMs = Number((performance.now() - tParse).toFixed(2));

    const result = await getFastAnalyticsPage(page, limit);

    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    const timings = {
      ...result.timings,
      parseParamsMs,
      totalHandlerMs: latencyMs,
      msSinceModuleLoad,
      region: process.env.VERCEL_REGION || "local",
    };

    const serverTimingHeader = [
      `cache_check;dur=${timings.cacheCheckMs}`,
      `db_wait;dur=${timings.dbWaitMs};desc="${timings.source}"`,
      `compute;dur=${timings.computeMs}`,
      `slice;dur=${timings.sliceMs}`,
      `total;dur=${latencyMs};desc="region=${timings.region}"`,
    ].join(", ");

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages,
          latencyMs,
          timings,
        },
        metrics: result.metrics,
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${latencyMs}ms`,
          "X-Cache-Status": "HIT",
          "Server-Timing": serverTimingHeader,
          "X-Analytics-Timings": JSON.stringify({
            source: timings.source,
            isColdStart: timings.isColdStart,
            region: timings.region,
            dbWaitMs: timings.dbWaitMs,
            computeMs: timings.computeMs,
            totalHandlerMs: timings.totalHandlerMs,
          }),
          "Cache-Control":
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
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
