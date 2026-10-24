"use client";

import React, { useState, useMemo } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  Plus,
  Search,
  Filter,
  RotateCcw,
  CheckSquare,
  Package,
  GripVertical,
  LogOut,
  X,
  CheckCircle2,
  Clock,
  Truck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  calculateAverageTicket,
  calculateProfitMargin,
  formatCurrency,
  filterOrders,
  OrderInputSchema,
  ProductInputSchema,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/analytics-utils";
import {
  KpiCardsSkeleton,
  KanbanBoardSkeleton,
  OrdersTableSkeleton,
} from "./Skeletons";

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  createdAt?: string | Date;
}

export interface AuthenticatedUser {
  name: string;
  email: string;
  image: string | null;
  provider?: string;
}

interface DashboardClientProps {
  initialOrders: OrderRecord[];
  initialProducts: ProductRecord[];
  currentUser: AuthenticatedUser;
}

const KANBAN_COLUMNS: {
  status: OrderStatus;
  label: string;
  badgeClass: string;
  borderClass: string;
}[] = [
  {
    status: "PENDING",
    label: "Pendientes (PENDING)",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    borderClass: "border-amber-500/30",
  },
  {
    status: "PROCESSING",
    label: "En Proceso (PROCESSING)",
    badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    borderClass: "border-blue-500/30",
  },
  {
    status: "SHIPPED",
    label: "Enviados (SHIPPED)",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    borderClass: "border-purple-500/30",
  },
  {
    status: "DELIVERED",
    label: "Entregados (DELIVERED)",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    borderClass: "border-emerald-500/30",
  },
];

export default function DashboardClient({
  initialOrders,
  initialProducts,
  currentUser,
}: DashboardClientProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts);
  const [isResetting, setIsResetting] = useState(false);

  // Drag & Drop state
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(
    null
  );

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] =
    useState<OrderStatus>("SHIPPED");

  // Modal state for creating Order or Product
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // New Order Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [totalAmount, setTotalAmount] = useState("299.99");
  const [costAmount, setCostAmount] = useState("165.00");
  const [itemsCount, setItemsCount] = useState("2");
  const [newOrderStatus, setNewOrderStatus] = useState<OrderStatus>("PENDING");
  const [orderFormError, setOrderFormError] = useState<string | null>(null);

  // New Product Form state
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productPrice, setProductPrice] = useState("199.99");
  const [productCost, setProductCost] = useState("110.00");
  const [productStock, setProductStock] = useState("45");
  const [productCategory, setProductCategory] = useState("Peripherals");
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Real-time KPI calculations
  const metrics = useMemo(() => {
    const totalRevenue = Number(
      orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toFixed(2)
    );
    const totalCost = Number(
      orders.reduce((sum, o) => sum + Number(o.costAmount || 0), 0).toFixed(2)
    );
    const averageTicket = calculateAverageTicket(orders);
    const profitMargin = calculateProfitMargin(totalRevenue, totalCost);
    return {
      totalRevenue,
      averageTicket,
      profitMargin,
      totalOrders: orders.length,
    };
  }, [orders]);

  // Filtered orders for the CRUD table
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, {
      status: statusFilter,
      search: searchQuery,
    });
  }, [orders, statusFilter, searchQuery]);

  // Optimistic Kanban Drag & Drop handler
  async function handleMoveOrder(orderId: string, targetStatus: OrderStatus) {
    setDragOverColumn(null);
    setDraggedOrderId(null);

    const existingOrder = orders.find((o) => o.id === orderId);
    if (!existingOrder || existingOrder.status === targetStatus) {
      return;
    }

    const previousStatus = existingOrder.status as OrderStatus;

    // 0ms Optimistic UI Update
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: targetStatus } : order
      )
    );

    toast.success(
      `Pedido ${orderId} movido a ${targetStatus} (Actualización optimista)`
    );

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!response.ok) {
        throw new Error("Error al persistir el cambio en el servidor");
      }
    } catch {
      // Rollback on failure
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: previousStatus } : order
        )
      );
      toast.error(
        `Error de red: Se revirtió el pedido ${orderId} a ${previousStatus}`
      );
    }
  }

  // Create Order Handler with Zod Validation
  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderFormError(null);

    const candidate = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      totalAmount: Number(totalAmount),
      costAmount: Number(costAmount),
      status: newOrderStatus,
      itemsCount: Number(itemsCount),
    };

    const validation = OrderInputSchema.safeParse(candidate);
    if (!validation.success) {
      const firstIssue =
        validation.error.issues[0]?.message || "Datos inválidos";
      setOrderFormError(firstIssue);
      toast.error(firstIssue);
      return;
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      if (!res.ok) {
        throw new Error("No se pudo registrar el pedido");
      }

      const json = await res.json();
      const createdOrder: OrderRecord = json.data;

      setOrders((prev) => [createdOrder, ...prev]);
      setCustomerName("");
      setCustomerEmail("");
      setTotalAmount("299.99");
      setCostAmount("165.00");
      setItemsCount("2");
      setNewOrderStatus("PENDING");
      setShowOrderModal(false);

      toast.success(
        `Pedido creado exitosamente para ${createdOrder.customerName}`
      );
    } catch {
      toast.error("Error al guardar el pedido en el servidor");
    }
  }

  // Create Product Handler with Zod Validation
  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setProductFormError(null);

    const candidate = {
      name: productName.trim(),
      sku: productSku.trim().toUpperCase(),
      price: Number(productPrice),
      cost: Number(productCost),
      stock: Number(productStock),
      category: productCategory.trim(),
    };

    const validation = ProductInputSchema.safeParse(candidate);
    if (!validation.success) {
      const firstIssue =
        validation.error.issues[0]?.message || "Datos de producto inválidos";
      setProductFormError(firstIssue);
      toast.error(firstIssue);
      return;
    }

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      if (!res.ok) {
        throw new Error("No se pudo crear el producto");
      }

      const json = await res.json();
      setProducts((prev) => [json.data, ...prev]);
      setProductName("");
      setProductSku("");
      setShowProductModal(false);
      toast.success(`Producto ${json.data.name} registrado exitosamente`);
    } catch {
      toast.error("Error al registrar el producto (verifique SKU único)");
    }
  }

  // Bulk Update Handler (Optimistic + Server Persistence)
  async function handleBulkStatusUpdate() {
    if (selectedOrderIds.length < 2) return;

    const previousOrders = [...orders];
    const idsToUpdate = [...selectedOrderIds];
    const targetStatus = bulkTargetStatus;

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((order) =>
        idsToUpdate.includes(order.id)
          ? { ...order, status: targetStatus }
          : order
      )
    );
    setSelectedOrderIds([]);

    toast.success(
      `Bulk Update: ${idsToUpdate.length} pedidos actualizados a ${targetStatus}`
    );

    try {
      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: idsToUpdate,
          status: targetStatus,
        }),
      });

      if (!res.ok) {
        throw new Error("Fallo en Bulk Update");
      }
    } catch {
      setOrders(previousOrders);
      toast.error("Error al ejecutar Bulk Update. Cambios revertidos.");
    }
  }

  // Reset Deterministic Data Handler
  async function handleResetData() {
    setIsResetting(true);
    try {
      const res = await fetch("/api/test/reset-data", { method: "POST" });
      if (!res.ok) throw new Error("Error resetting data");

      const analyticsRes = await fetch("/api/test/analytics?page=1&limit=100");
      const analyticsJson = await analyticsRes.json();
      setOrders(analyticsJson.data || []);
      setSelectedOrderIds([]);
      toast.success("Datos de prueba deterministas restaurados (50 pedidos)");
    } catch {
      toast.error("No se pudieron restaurar los datos de prueba");
    } finally {
      setIsResetting(false);
    }
  }

  function toggleOrderSelection(id: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllFiltered() {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  }

  async function handleLogout() {
    document.cookie =
      "x-e2e-test-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie =
      "omnimarket-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    await signOut({ callbackUrl: "/login" });
  }

  if (isResetting) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
        <KpiCardsSkeleton />
        <KanbanBoardSkeleton />
        <OrdersTableSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                OmniMarket — Operations Hub
              </h1>
              <p className="text-xs text-slate-400">
                Real-Time E-Commerce Analytics & Fulfillment Control Center
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="open-create-order-btn"
              onClick={() => setShowOrderModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Nuevo Pedido
            </button>

            <button
              type="button"
              data-testid="open-create-product-btn"
              onClick={() => setShowProductModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              <Package className="h-4 w-4 text-indigo-400" />
              Nuevo Producto
            </button>

            <button
              type="button"
              data-testid="reset-data-btn"
              onClick={handleResetData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
              title="Restaurar 50 pedidos deterministas"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Test Data
            </button>

            {/* Logged-in User Account Pill */}
            <div
              data-testid="user-account-info"
              className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5"
            >
              {currentUser.image ? (
                <img
                  src={currentUser.image}
                  alt={currentUser.name}
                  className="h-7 w-7 rounded-full border border-indigo-500/40 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400">
                  <UserCheck className="h-4 w-4" />
                </div>
              )}
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">
                    {currentUser.name}
                  </span>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-indigo-300">
                    {currentUser.provider || "OAuth"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Section 1: Real-Time KPI Cards */}
        <section aria-label="KPI Metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              data-testid="kpi-total-revenue"
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Ingresos Totales
                </span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatCurrency(metrics.totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-emerald-400">
                Sincronizado en tiempo real (&lt;300ms SLA)
              </p>
            </div>

            <div
              data-testid="kpi-average-ticket"
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Ticket Promedio
                </span>
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatCurrency(metrics.averageTicket)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Promedio por orden procesada
              </p>
            </div>

            <div
              data-testid="kpi-profit-margin"
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Margen de Ganancia
                </span>
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
                  <Percent className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {metrics.profitMargin}%
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Rentabilidad neta operativa
              </p>
            </div>

            <div
              data-testid="kpi-total-orders"
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total de Pedidos
                </span>
                <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {metrics.totalOrders}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {products.length} productos activos en catálogo
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Kanban Board with Drag & Drop & Optimistic Persistence */}
        <section aria-label="Kanban Fulfillment Board" className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Tablero Kanban de Fulfillment (Drag &amp; Drop Optimista)
              </h2>
              <p className="text-xs text-slate-400">
                Arrastra cualquier tarjeta entre columnas para actualizar el
                estado en 0ms con persistencia automática.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {KANBAN_COLUMNS.map((col) => {
              const columnOrders = orders.filter(
                (o) => o.status === col.status
              );
              const isDropTarget = dragOverColumn === col.status;

              return (
                <div
                  key={col.status}
                  data-testid={`column-${col.status}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== col.status) {
                      setDragOverColumn(col.status);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === col.status) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const transferredId =
                      e.dataTransfer?.getData("text/plain") || draggedOrderId;
                    if (transferredId) {
                      handleMoveOrder(transferredId, col.status);
                    }
                  }}
                  className={`flex max-h-[540px] flex-col rounded-xl border p-4 transition ${
                    isDropTarget
                      ? "border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40"
                      : "border-slate-800 bg-slate-900/60"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      {col.status === "PENDING" && (
                        <Clock className="h-4 w-4 text-amber-400" />
                      )}
                      {col.status === "PROCESSING" && (
                        <Package className="h-4 w-4 text-blue-400" />
                      )}
                      {col.status === "SHIPPED" && (
                        <Truck className="h-4 w-4 text-purple-400" />
                      )}
                      {col.status === "DELIVERED" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <h3 className="text-sm font-semibold text-slate-200">
                        {col.status}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${col.badgeClass}`}
                    >
                      {columnOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                    {columnOrders.map((order) => {
                      const domCardId = order.id.startsWith("order-")
                        ? order.id
                        : `order-${order.id}`;

                      return (
                        <div
                          key={order.id}
                          id={domCardId}
                          data-testid={`order-card-${order.id}`}
                          draggable
                          onDragStart={(e) => {
                            setDraggedOrderId(order.id);
                            if (e.dataTransfer) {
                              e.dataTransfer.setData("text/plain", order.id);
                              e.dataTransfer.effectAllowed = "move";
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedOrderId(null);
                            setDragOverColumn(null);
                          }}
                          className="group cursor-grab rounded-lg border border-slate-800 bg-slate-950/90 p-3.5 shadow-sm transition hover:border-indigo-500/50 active:cursor-grabbing"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-400">
                              <GripVertical className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" />
                              {order.id}
                            </span>
                            <span className="text-xs font-bold text-emerald-400">
                              {formatCurrency(order.totalAmount)}
                            </span>
                          </div>
                          <p className="mt-1.5 truncate text-sm font-medium text-slate-100">
                            {order.customerName}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate">
                              {order.customerEmail}
                            </span>
                            <span>{order.itemsCount} items</span>
                          </div>
                        </div>
                      );
                    })}

                    {columnOrders.length === 0 && (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
                        Suelta pedidos aquí ({col.status})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Advanced CRUD Table + Bulk Update */}
        <section
          aria-label="Orders Management Table"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm"
        >
          <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Gestión Avanzada de Pedidos &amp; Edición en Lote
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona 2 o más pedidos para activar la barra de acciones
                masivas (Bulk Update).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  data-testid="search-orders-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por cliente, email o ID..."
                  className="w-64 rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  data-testid="filter-status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Update Action Bar (Visible when >= 2 rows selected) */}
          {selectedOrderIds.length >= 2 && (
            <div
              data-testid="bulk-update-bar"
              className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-200">
                <CheckSquare className="h-4 w-4 text-indigo-400" />
                <span>
                  <strong>{selectedOrderIds.length}</strong> pedidos
                  seleccionados para edición en lote
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  data-testid="bulk-status-select"
                  value={bulkTargetStatus}
                  onChange={(e) =>
                    setBulkTargetStatus(e.target.value as OrderStatus)
                  }
                  className="rounded-lg border border-indigo-500/40 bg-slate-950 px-3 py-1.5 text-sm text-white focus:outline-none"
                >
                  <option value="PENDING">Mover a PENDING</option>
                  <option value="PROCESSING">Mover a PROCESSING</option>
                  <option value="SHIPPED">Mover a SHIPPED</option>
                  <option value="DELIVERED">Mover a DELIVERED</option>
                </select>

                <button
                  type="button"
                  data-testid="apply-bulk-update-btn"
                  onClick={handleBulkStatusUpdate}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                >
                  Aplicar Bulk Update
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  Cancelar selección
                </button>
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table
              className="w-full text-left text-sm"
              data-testid="orders-table"
            >
              <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={
                        filteredOrders.length > 0 &&
                        selectedOrderIds.length === filteredOrders.length
                      }
                      onChange={toggleSelectAllFiltered}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-3">ID Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <tr
                      key={order.id}
                      data-testid={`table-row-${order.id}`}
                      className={`transition hover:bg-slate-800/40 ${
                        isSelected ? "bg-indigo-950/25" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          data-testid={`select-order-${order.id}`}
                          checked={isSelected}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-400">
                        {order.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {order.customerName}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {order.customerEmail}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.itemsCount}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatCurrency(order.costAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            order.status === "PENDING"
                              ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                              : order.status === "PROCESSING"
                              ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                              : order.status === "SHIPPED"
                              ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                              : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal: Create New Order */}
      {showOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          data-testid="create-order-modal"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                Registrar Nuevo Pedido
              </h3>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {orderFormError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {orderFormError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  data-testid="input-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. Valeria Montes"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Email del Cliente
                </label>
                <input
                  type="email"
                  required
                  data-testid="input-customer-email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="valeria@empresa.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Monto Total (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-testid="input-total-amount"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Costo Operativo (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-testid="input-cost-amount"
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Cantidad de Items
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    data-testid="input-items-count"
                    value={itemsCount}
                    onChange={(e) => setItemsCount(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Estado Inicial
                  </label>
                  <select
                    data-testid="select-order-status"
                    value={newOrderStatus}
                    onChange={(e) =>
                      setNewOrderStatus(e.target.value as OrderStatus)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PROCESSING">PROCESSING</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-order-btn"
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                >
                  Guardar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Product */}
      {showProductModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          data-testid="create-product-modal"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                Registrar Nuevo Producto en Catálogo
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {productFormError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {productFormError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ej. Cámara PTZ 4K Pro"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    SKU Único
                  </label>
                  <input
                    type="text"
                    required
                    value={productSku}
                    onChange={(e) => setProductSku(e.target.value)}
                    placeholder="OMNI-CAM-999"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Categoría
                  </label>
                  <input
                    type="text"
                    required
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Precio (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Costo (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    required
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
