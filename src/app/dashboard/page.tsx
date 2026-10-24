import { prisma } from "@/lib/prisma";
import { seedInitialData } from "@/lib/seed-data";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const count = await prisma.order.count();
  if (count === 0) {
    await seedInitialData(true);
  }

  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedOrders = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const serializedProducts = products.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      initialOrders={serializedOrders}
      initialProducts={serializedProducts}
    />
  );
}
