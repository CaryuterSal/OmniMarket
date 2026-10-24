import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedInitialData } from "@/lib/seed-data";
import DashboardClient, { type AuthenticatedUser } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [session, count] = await Promise.all([
    getServerSession(authOptions),
    prisma.order.count(),
  ]);

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

  const currentUser: AuthenticatedUser = session?.user
    ? {
        name: session.user.name || "Usuario Autenticado",
        email: session.user.email || "sin-email@omnimarket.io",
        image: session.user.image || null,
        provider:
          (session.user as { provider?: string }).provider || "oauth",
      }
    : {
        name: "Operador E2E / Demo",
        email: "operator@omnimarket.io",
        image: null,
        provider: "sandbox",
      };

  return (
    <DashboardClient
      initialOrders={serializedOrders}
      initialProducts={serializedProducts}
      currentUser={currentUser}
    />
  );
}
