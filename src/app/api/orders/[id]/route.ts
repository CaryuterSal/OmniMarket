import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatusEnum } from "@/lib/analytics-utils";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const parsedStatus = OrderStatusEnum.safeParse(body.status);
    if (!parsedStatus.success) {
      return NextResponse.json(
        { error: "Estado de pedido inválido" },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: parsedStatus.data,
      },
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el pedido" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el pedido" },
      { status: 500 }
    );
  }
}
