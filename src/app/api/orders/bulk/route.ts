import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BulkOrderUpdateSchema } from "@/lib/analytics-utils";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BulkOrderUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de actualización en lote inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { orderIds, status } = parsed.data;

    const result = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    invalidateAnalyticsCache();

    return NextResponse.json(
      {
        ok: true,
        updatedCount: result.count,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in bulk order update:", error);
    return NextResponse.json(
      { error: "Error al actualizar pedidos en lote" },
      { status: 500 }
    );
  }
}
