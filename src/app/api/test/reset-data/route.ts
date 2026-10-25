import { NextRequest, NextResponse } from "next/server";
import { resetDeterministicTestData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Protect this destructive endpoint with a shared secret.
  // Callers must send: Authorization: Bearer <RESET_SECRET>
  // If RESET_SECRET is not configured in the environment, the endpoint is
  // always locked (returns 401) to prevent accidental production data loss.
  const resetSecret = process.env.RESET_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  const providedToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!resetSecret || providedToken !== resetSecret) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — valid RESET_SECRET required" },
      { status: 401 }
    );
  }

  const startTime = performance.now();
  try {
    const result = await resetDeterministicTestData();
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return NextResponse.json(
      {
        ok: true,
        message: "Database reset with deterministic E2E dataset",
        ...result,
        latencyMs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/test/reset-data:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reset database" },
      { status: 500 }
    );
  }
}

