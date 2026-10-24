import { NextResponse } from "next/server";
import { resetDeterministicTestData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
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
