import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;
  if (rawUrl.includes("pgbouncer=true") && !rawUrl.includes("connect_timeout=")) {
    return `${rawUrl}&connection_limit=5&pool_timeout=10&connect_timeout=10`;
  }
  return rawUrl;
}

const resolvedUrl = buildDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
