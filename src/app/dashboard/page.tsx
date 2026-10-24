import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedInitialData } from "@/lib/seed-data";
import { primeAnalyticsCache } from "@/lib/analytics-cache";
import DashboardClient, { type AuthenticatedUser } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [session, initialOrders, initialProducts] = await Promise.all([
    getServerSession(authOptions),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let orders = initialOrders;
  let products = initialProducts;

  if (orders.length === 0) {
    await seedInitialData(true);
    [orders, products] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);
  } else {
    primeAnalyticsCache(orders);
  }

  const serializedOrders = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const serializedProducts = products.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  const currentUser: AuthenticatedUser = session?.user
    ? {
        name: session.user.name || "Usuario Autenticado",
        email: session.user.email || "sin-email@omnimarket.io",
        image: session.user.image || null,
        provider:
          (session.user as { provider?: string }).provider || "oauth",
      }
    : {
        name: "Operador Autenticado",
        email: "operator@omnimarket.io",
        image: null,
        provider: "oauth",
      };

  return (
    <DashboardClient
      initialOrders={serializedOrders}
      initialProducts={serializedProducts}
      currentUser={currentUser}
    />
  );
}
