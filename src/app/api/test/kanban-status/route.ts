import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedInitialData } from "@/lib/seed-data";
import { primeAnalyticsCache } from "@/lib/analytics-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    let allOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (allOrders.length === 0) {
      await seedInitialData(true);
      allOrders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
      });
    } else {
      primeAnalyticsCache(allOrders);
    }

    const columns: Record<string, typeof allOrders> = {
      PENDING: [],
      PROCESSING: [],
      SHIPPED: [],
      DELIVERED: [],
    };

    const counts: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
    };

    for (const order of allOrders) {
      if (!columns[order.status]) {
        columns[order.status] = [];
      }
      columns[order.status].push(order);
      counts[order.status] = (counts[order.status] || 0) + 1;
    }

    const requestedOrder = orderId
      ? allOrders.find((o) => o.id === orderId) ?? null
      : null;

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return NextResponse.json(
      {
        orderId: orderId ?? undefined,
        status: requestedOrder ? requestedOrder.status : null,
        order: requestedOrder,
        counts,
        columns,
        latencyMs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/test/kanban-status:", error);
    return NextResponse.json(
      { error: "Failed to query kanban status" },
      { status: 500 }
    );
  }
}
