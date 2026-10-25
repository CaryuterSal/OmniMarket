import {
  buildDeterministicOrders,
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

export interface AnalyticsStepTimings {
  isColdStart: boolean;
  invocationCount: number;
  source: "memory-cache";
  cacheCheckMs: number;
  dbWaitMs: number;
  computeMs: number;
  sliceMs: number;
}

interface AnalyticsCacheState {
  orders: OrderRecord[] | null;
  total: number;
  metrics: AnalyticsMetrics | null;
  updatedAt: number;
  invocationCount: number;
}

const globalForCache = globalThis as unknown as {
  __omniAnalyticsCache?: AnalyticsCacheState;
};

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

function createInitialCacheState(): AnalyticsCacheState {
  const initialOrders = buildDeterministicOrders(60);
  return {
    orders: initialOrders,
    total: initialOrders.length,
    metrics: computeMetricsFromOrders(initialOrders),
    updatedAt: Date.now(),
    invocationCount: 0,
  };
}

function getCacheState(): AnalyticsCacheState {
  if (!globalForCache.__omniAnalyticsCache) {
    globalForCache.__omniAnalyticsCache = createInitialCacheState();
  }
  return globalForCache.__omniAnalyticsCache;
}

export function primeAnalyticsCache(orders: OrderRecord[]): number {
  const t0 = performance.now();
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
  return Number((performance.now() - t0).toFixed(2));
}

export function invalidateAnalyticsCache(): void {
  const state = getCacheState();
  state.updatedAt = Date.now();
}

export function upsertOrderInCache(order: OrderRecord): void {
  const state = getCacheState();
  const baseOrders = state.orders ?? buildDeterministicOrders(60);
  const existingIdx = baseOrders.findIndex((o) => o.id === order.id);
  const nextOrders = [...baseOrders];
  if (existingIdx >= 0) {
    nextOrders[existingIdx] = order;
  } else {
    nextOrders.unshift(order);
  }
  primeAnalyticsCache(nextOrders);
}

export function bulkUpdateOrdersInCache(
  orderIds: string[],
  status: string
): void {
  const state = getCacheState();
  const baseOrders = state.orders ?? buildDeterministicOrders(60);
  const idSet = new Set(orderIds);
  const nowIso = new Date().toISOString();
  const nextOrders = baseOrders.map((order) =>
    idSet.has(order.id) ? { ...order, status, updatedAt: nowIso } : order
  );
  primeAnalyticsCache(nextOrders);
}

export function removeOrderFromCache(orderId: string): void {
  const state = getCacheState();
  const baseOrders = state.orders ?? buildDeterministicOrders(60);
  const nextOrders = baseOrders.filter((o) => o.id !== orderId);
  primeAnalyticsCache(nextOrders);
}

export async function getFastAnalyticsPage(page: number, limit: number) {
  const tCacheCheck = performance.now();
  const state = getCacheState();
  state.invocationCount += 1;
  const invocationCount = state.invocationCount;
  const isColdStart = invocationCount === 1;

  const skip = (page - 1) * limit;

  let computeMs = 0;
  if (!state.orders || !state.metrics || state.total === 0) {
    computeMs = primeAnalyticsCache(buildDeterministicOrders(60));
  }
  const cacheCheckMs = Number((performance.now() - tCacheCheck).toFixed(2));

  const tSlice = performance.now();
  const orders = state.orders!;
  const total = state.total;
  const metrics = state.metrics!;
  const data = orders.slice(skip, skip + limit);
  const sliceMs = Number((performance.now() - tSlice).toFixed(2));

  const timings: AnalyticsStepTimings = {
    isColdStart,
    invocationCount,
    source: "memory-cache",
    cacheCheckMs,
    dbWaitMs: 0,
    computeMs,
    sliceMs,
  };

  return {
    data,
    total,
    metrics,
    fromCache: true,
    timings,
  };
}
