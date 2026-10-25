import { NextRequest, NextResponse } from "next/server";
import { buildDeterministicOrders } from "@/lib/analytics-utils";
import {
  getFastAnalyticsPage,
  primeAnalyticsCache,
} from "@/lib/analytics-cache";

// Co-locate the serverless function with the Supabase pooler in us-west-2 (pdx1)
export const preferredRegion = ["pdx1", "sfo1", "iad1"];

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

    let result = await getFastAnalyticsPage(page, limit);

    if (result.total === 0) {
      primeAnalyticsCache(buildDeterministicOrders(60));
      void import("@/lib/seed-data")
        .then(({ seedInitialData }) => seedInitialData(true))
        .catch(() => {
          // Ignore background seed errors
        });
      result = await getFastAnalyticsPage(page, limit);
    }

    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    const timings = {
      ...result.timings,
      parseParamsMs,
      totalHandlerMs: latencyMs,
      msSinceModuleLoad,
      region: process.env.VERCEL_REGION || "local",
    };

    // Structured log for Vercel Runtime Logs
    console.log(
      JSON.stringify({
        tag: "ANALYTICS_REQUEST_TRACE",
        page,
        limit,
        cacheStatus: result.fromCache ? "HIT" : "MISS",
        ...timings,
      })
    );

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
          "X-Cache-Status": result.fromCache ? "HIT" : "MISS",
          "Server-Timing": serverTimingHeader,
          "X-Analytics-Timings": JSON.stringify({
            source: timings.source,
            isColdStart: timings.isColdStart,
            region: timings.region,
            dbWaitMs: timings.dbWaitMs,
            computeMs: timings.computeMs,
            totalHandlerMs: timings.totalHandlerMs,
            lastDbQueryMs: timings.lastDbRefresh?.dbQueryMs ?? null,
            lastPrismaImportMs: timings.lastDbRefresh?.prismaImportMs ?? null,
          }),
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
