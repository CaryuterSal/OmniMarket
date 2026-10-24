import React from "react";

export function KpiCardsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="kpi-skeleton"
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-800" />
          </div>
          <div className="mt-4 h-8 w-36 animate-pulse rounded bg-slate-800" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-800/70" />
        </div>
      ))}
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      data-testid="kanban-skeleton"
    >
      {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"].map((col) => (
        <div
          key={col}
          className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="h-5 w-28 animate-pulse rounded bg-slate-800" />
            <div className="h-6 w-8 animate-pulse rounded-full bg-slate-800" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-3.5"
              >
                <div className="flex justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                </div>
                <div className="mt-3 h-4 w-36 animate-pulse rounded bg-slate-800" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-800/70" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrdersTableSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
      data-testid="table-skeleton"
    >
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-800" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-800" />
        </div>
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-800" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-800" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-7 w-64 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-80 animate-pulse rounded bg-slate-800/70" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-800" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-800" />
        </div>
      </div>
      <KpiCardsSkeleton />
      <KanbanBoardSkeleton />
      <OrdersTableSkeleton />
    </div>
  );
}
