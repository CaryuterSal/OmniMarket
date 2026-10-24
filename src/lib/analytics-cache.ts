import { prisma } from "./prisma";
import {
  calculateAverageTicket,
  calculateProfitMargin,
  type OrderRecord,
} from "./analytics-utils";

export interface AnalyticsMetrics {
  totalRevenue: number;
  averageTicket: number;
  profitMargin: number;
  ordersByStatus: Record<string, number>;
}

interface AnalyticsCacheState {
  orders: OrderRecord[] | null;
  total: number;
  metrics: AnalyticsMetrics | null;
  updatedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds TTL

const globalForCache = globalThis as unknown as {
  __omniAnalyticsCache?: AnalyticsCacheState;
};

function getCacheState(): AnalyticsCacheState {
  if (!globalForCache.__omniAnalyticsCache) {
    globalForCache.__omniAnalyticsCache = {
      orders: null,
      total: 0,
      metrics: null,
      updatedAt: 0,
    };
  }
  return globalForCache.__omniAnalyticsCache;
}

export function invalidateAnalyticsCache(): void {
  const state = getCacheState();
  state.orders = null;
  state.total = 0;
  state.metrics = null;
  state.updatedAt = 0;
}

export function computeMetricsFromOrders(
  orders: Array<{
    totalAmount: number;
    costAmount: number;
    status: string;
  }>
): AnalyticsMetrics {
  const totalRevenue = Number(
    orders.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0).toFixed(2)
  );
  const totalCost = Number(
    orders.reduce((acc, o) => acc + Number(o.costAmount || 0), 0).toFixed(2)
  );

  const averageTicket = calculateAverageTicket(orders);
  const profitMargin = calculateProfitMargin(totalRevenue, totalCost);

  const ordersByStatus: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
  };

  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
  }

  return {
    totalRevenue,
    averageTicket,
    profitMargin,
    ordersByStatus,
  };
}

export function primeAnalyticsCache(orders: OrderRecord[]): void {
  const state = getCacheState();
  const sorted = [...orders].sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });
  state.orders = sorted;
  state.total = sorted.length;
  state.metrics = computeMetricsFromOrders(sorted);
  state.updatedAt = Date.now();
}

export async function getFastAnalyticsPage(page: number, limit: number) {
  const state = getCacheState();
  const now = Date.now();
  const skip = (page - 1) * limit;

  // 1. Serve from in-memory cache if valid and covering requested range
  if (
    state.orders &&
    state.metrics &&
    state.total > 0 &&
    now - state.updatedAt < CACHE_TTL_MS
  ) {
    const data = state.orders.slice(skip, skip + limit);
    return {
      data,
      total: state.total,
      metrics: state.metrics,
      fromCache: true,
    };
  }

  // 2. Single parallel DB roundtrip: fetch orders + SQL groupBy aggregation
  const [ordersPaginated, statusGroups] = await Promise.all([
    prisma.order.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        costAmount: true,
      },
    }),
  ]);

  const ordersByStatus: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
  };

  let total = 0;
  let rawRevenue = 0;
  let rawCost = 0;

  for (const group of statusGroups) {
    const count = group._count._all;
    ordersByStatus[group.status] = (ordersByStatus[group.status] || 0) + count;
    total += count;
    rawRevenue += Number(group._sum.totalAmount || 0);
    rawCost += Number(group._sum.costAmount || 0);
  }

  const totalRevenue = Number(rawRevenue.toFixed(2));
  const totalCost = Number(rawCost.toFixed(2));
  const averageTicket =
    total > 0 ? Number((totalRevenue / total).toFixed(2)) : 0;
  const profitMargin = calculateProfitMargin(totalRevenue, totalCost);

  const metrics: AnalyticsMetrics = {
    totalRevenue,
    averageTicket,
    profitMargin,
    ordersByStatus,
  };

  // If the first page covers all existing orders (e.g., total <= limit), cache the full list in memory
  if (skip === 0 && ordersPaginated.length === total && total > 0) {
    state.orders = ordersPaginated;
    state.total = total;
    state.metrics = metrics;
    state.updatedAt = Date.now();
  } else if (total > 0) {
    // Refresh full cache asynchronously in the background without blocking the response
    prisma.order
      .findMany({ orderBy: { createdAt: "desc" } })
      .then((allOrders) => {
        if (allOrders.length > 0) {
          primeAnalyticsCache(allOrders);
        }
      })
      .catch(() => {
        // Ignore background cache warm errors
      });
  }

  return {
    data: ordersPaginated,
    total,
    metrics,
    fromCache: false,
  };
}
