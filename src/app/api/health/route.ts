import { NextRequest, NextResponse } from "next/server";
import { getFastAnalyticsPage } from "@/lib/analytics-cache";

export const dynamic = "force-dynamic";
export const preferredRegion = "sfo1";

const startedAt = Date.now();

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  const origin = new URL(request.url).origin;

  // 1. Warm the in-process analytics cache & Prisma connection
  // 2. Also ping /api/test/analytics so Vercel keeps that route's Lambda warm too
  await Promise.allSettled([
    getFastAnalyticsPage(1, 50),
    fetch(`${origin}/api/test/analytics?page=1&limit=50`, {
      method: "GET",
      headers: { "x-health-warmup": "1" },
      cache: "no-store",
    }),
  ]);

  const latencyMs = Number((performance.now() - t0).toFixed(2));

  return NextResponse.json(
    {
      status: "ok",
      service: "omnimarket-operations-hub",
      warmedEndpoints: ["/api/health", "/api/test/analytics"],
      region: process.env.VERCEL_REGION || "local",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      latencyMs,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Response-Time": `${latencyMs}ms`,
      },
    }
  );
}

export async function HEAD(request: NextRequest) {
  const origin = new URL(request.url).origin;

  await Promise.allSettled([
    getFastAnalyticsPage(1, 50),
    fetch(`${origin}/api/test/analytics?page=1&limit=50`, {
      method: "GET",
      headers: { "x-health-warmup": "1" },
      cache: "no-store",
    }),
  ]);

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
