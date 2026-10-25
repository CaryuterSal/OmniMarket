import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnectPromise: Promise<void> | undefined;
};

function buildDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;
  if (rawUrl.includes("pgbouncer=true") && !rawUrl.includes("connect_timeout=")) {
    return `${rawUrl}&connection_limit=3&pool_timeout=10&connect_timeout=10`;
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

globalForPrisma.prisma = prisma;

// Eagerly initiate the database engine and TLS handshake at module import time
// to minimize cold-start latency when the first request arrives.
export const prismaConnectPromise =
  globalForPrisma.prismaConnectPromise ??
  (resolvedUrl
    ? prisma.$connect().catch(() => {
        // Query-level error handling will catch connection issues if any
      })
    : Promise.resolve());

globalForPrisma.prismaConnectPromise = prismaConnectPromise;
