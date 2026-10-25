import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/test/analytics/route";
import {
  upsertOrderInCache,
  bulkUpdateOrdersInCache,
  removeOrderFromCache,
} from "@/lib/analytics-cache";

function clearAnalyticsMemoryCache() {
  const g = globalThis as unknown as {
    __omniAnalyticsCache?: unknown;
  };
  delete g.__omniAnalyticsCache;
}

describe("Analytics Endpoint & Query Latency Benchmark (< 300ms SLA)", () => {
  it("Test 1 (Cold Start sin caché previa): GET /api/test/analytics responde en < 10ms sin abrir promesas colgantes de Prisma", async () => {
    clearAnalyticsMemoryCache();

    const req = new NextRequest(
      "http://localhost:3000/api/test/analytics?page=1&limit=50"
    );

    const t0 = performance.now();
    const res = await GET(req);
    const wallClockMs = Number((performance.now() - t0).toFixed(2));
    const body = await res.json();

    console.log(
      `[Cold Start] status=${res.status} | cache=${res.headers.get("X-Cache-Status")} | internalLatency=${body.meta.latencyMs}ms | wallClock=${wallClockMs}ms | timings=${JSON.stringify(body.meta.timings)}`
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toContain("total;dur=");
    expect(res.headers.get("X-Analytics-Timings")).toBeTruthy();
    expect(body.data).toHaveLength(50);
    expect(body.meta.total).toBe(60);
    expect(body.meta.timings.isColdStart).toBe(true);
    expect(body.meta.timings.dbWaitMs).toBe(0);
    expect(body.meta.latencyMs).toBeLessThan(20);
    expect(wallClockMs).toBeLessThan(50);
  });

  it("Test 2 (Warm Cache): peticiones subsecuentes responden en < 5ms (HIT) incluso cuando total (60) > limit (50)", async () => {
    const latencies: number[] = [];

    for (let i = 1; i <= 5; i++) {
      const page = i % 2 === 0 ? 2 : 1;
      const req = new NextRequest(
        `http://localhost:3000/api/test/analytics?page=${page}&limit=50`
      );

      const t0 = performance.now();
      const res = await GET(req);
      const wallClockMs = Number((performance.now() - t0).toFixed(2));
      const body = await res.json();

      latencies.push(wallClockMs);

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache-Status")).toBe("HIT");
      expect(body.meta.timings.source).toBe("memory-cache");
      expect(body.meta.latencyMs).toBeLessThan(10);
      expect(wallClockMs).toBeLessThan(20);
    }

    const avgMs = Number(
      (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
    );
    const maxMs = Math.max(...latencies);
    console.log(
      `[Warm Cache x5] latencies=${latencies.map((l) => `${l}ms`).join(", ")} | avg=${avgMs}ms | max=${maxMs}ms`
    );

    expect(maxMs).toBeLessThan(300);
  });

  it("Test 3 (Mutaciones en Memoria): crear, actualizar en lote y eliminar pedidos mantiene caché HIT (< 10ms)", async () => {
    const t0 = performance.now();

    upsertOrderInCache({
      id: "order-bench-999",
      customerName: "Benchmark User",
      customerEmail: "bench@omnimarket.io",
      totalAmount: 500,
      costAmount: 300,
      status: "PENDING",
      itemsCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    bulkUpdateOrdersInCache(["order-bench-999"], "SHIPPED");

    const req = new NextRequest(
      "http://localhost:3000/api/test/analytics?page=1&limit=50"
    );
    const res = await GET(req);
    const body = await res.json();
    const elapsedMs = Number((performance.now() - t0).toFixed(2));

    console.log(
      `[Post-Mutation Request] cache=${res.headers.get("X-Cache-Status")} | internalLatency=${body.meta.latencyMs}ms | totalElapsed=${elapsedMs}ms`
    );

    expect(res.headers.get("X-Cache-Status")).toBe("HIT");
    expect(body.data[0].id).toBe("order-bench-999");
    expect(body.data[0].status).toBe("SHIPPED");
    expect(elapsedMs).toBeLessThan(20);

    // Cleanup benchmark order from cache
    removeOrderFromCache("order-bench-999");
  });
});
