import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProductInputSchema } from "@/lib/analytics-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: products }, { status: 200 });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ProductInputSchema.safeParse({
      ...body,
      price: Number(body.price),
      cost: Number(body.cost),
      stock: Number(body.stock),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de producto inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await prisma.product.create({
      data: parsed.data,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "No se pudo crear el producto (verifique SKU único)" },
      { status: 500 }
    );
  }
}
