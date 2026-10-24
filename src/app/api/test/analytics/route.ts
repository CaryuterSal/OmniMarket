import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedInitialData } from "@/lib/seed-data";
import {
  calculateAverageTicket,
  calculateProfitMargin,
} from "@/lib/analytics-utils";

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
    const skip = (page - 1) * limit;

    let total = await prisma.order.count();
    if (total === 0) {
      await seedInitialData(true);
      total = await prisma.order.count();
    }

    const [ordersPaginated, allOrdersSummary] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        select: {
          totalAmount: true,
          costAmount: true,
          status: true,
        },
      }),
    ]);

    const totalRevenue = Number(
      allOrdersSummary
        .reduce((acc, o) => acc + o.totalAmount, 0)
        .toFixed(2)
    );
    const totalCost = Number(
      allOrdersSummary
        .reduce((acc, o) => acc + o.costAmount, 0)
        .toFixed(2)
    );

    const averageTicket = calculateAverageTicket(allOrdersSummary);
    const profitMargin = calculateProfitMargin(totalRevenue, totalCost);

    const ordersByStatus: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
    };

    for (const order of allOrdersSummary) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return NextResponse.json(
      {
        data: ordersPaginated,
        meta: {
          page,
          limit,
          total,
          totalPages,
          latencyMs,
        },
        metrics: {
          totalRevenue,
          averageTicket,
          profitMargin,
          ordersByStatus,
        },
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${latencyMs}ms`,
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
