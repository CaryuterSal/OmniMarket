import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderInputSchema } from "@/lib/analytics-utils";
import { invalidateAnalyticsCache, primeAnalyticsCache } from "@/lib/analytics-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    primeAnalyticsCache(orders);
    return NextResponse.json({ data: orders }, { status: 200 });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = OrderInputSchema.safeParse({
      ...body,
      totalAmount: Number(body.totalAmount),
      costAmount:
        body.costAmount !== undefined
          ? Number(body.costAmount)
          : Number((Number(body.totalAmount) * 0.6).toFixed(2)),
      itemsCount:
        body.itemsCount !== undefined ? Number(body.itemsCount) : 1,
      status: body.status || "PENDING",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de pedido inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await prisma.order.create({
      data: parsed.data,
    });

    invalidateAnalyticsCache();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
