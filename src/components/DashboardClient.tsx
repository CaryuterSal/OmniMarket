"use client";

import React, { useState, useMemo, useRef } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  Plus,
  Search,
  RotateCcw,
  Package,
  GripVertical,
  LogOut,
  X,
  CheckCircle2,
  Clock,
  Truck,
  Store,
  LayoutDashboard,
  Kanban,
  ClipboardList,
  Boxes,
  User,
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
  title: string;
  dotColor: string;
  pillClass: string;
}[] = [
  {
    status: "PENDING",
    title: "Por confirmar",
    dotColor: "bg-amber-500",
    pillClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    status: "PROCESSING",
    title: "En preparación",
    dotColor: "bg-blue-600",
    pillClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    status: "SHIPPED",
    title: "En camino",
    dotColor: "bg-purple-600",
    pillClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    status: "DELIVERED",
    title: "Entregados",
    dotColor: "bg-emerald-600",
    pillClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Por confirmar",
  PROCESSING: "En preparación",
  SHIPPED: "En camino",
  DELIVERED: "Entregado",
};

export default function DashboardClient({
  initialOrders,
  initialProducts,
  currentUser,
}: DashboardClientProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts);
  const [isResetting, setIsResetting] = useState(false);
  const [activeNav, setActiveNav] = useState<
    "all" | "board" | "orders" | "catalog"
  >("all");

  // Drag & Drop state
  const mouseDownOrderIdRef = useRef<string | null>(null);
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

  // Modal state
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
  const [productCategory, setProductCategory] = useState("Periféricos");
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Metrics
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

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, {
      status: statusFilter,
      search: searchQuery,
    });
  }, [orders, statusFilter, searchQuery]);

  // Move order across columns
  async function handleMoveOrder(orderId: string, targetStatus: OrderStatus) {
    mouseDownOrderIdRef.current = null;
    setDragOverColumn(null);
    setDraggedOrderId(null);

    const existingOrder = orders.find((o) => o.id === orderId);
    if (!existingOrder || existingOrder.status === targetStatus) {
      return;
    }

    const previousStatus = existingOrder.status as OrderStatus;

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: targetStatus } : order
      )
    );

    toast.success(
      `Pedido ${orderId} actualizado a ${STATUS_LABELS[targetStatus] || targetStatus}`
    );

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar cambio");
      }
    } catch {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: previousStatus } : order
        )
      );
      toast.error(
        `No se pudo actualizar el pedido ${orderId}. Se restauró su estado anterior.`
      );
    }
  }

  // Create Order
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
        validation.error.issues[0]?.message || "Verifica los datos ingresados";
      setOrderFormError(firstIssue);
      toast.error(firstIssue);
      return;
    }

    const optimisticId = `order-${Date.now()}`;
    const optimisticOrder: OrderRecord = {
      id: optimisticId,
      ...validation.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOrders((prev) => [optimisticOrder, ...prev]);
    setCustomerName("");
    setCustomerEmail("");
    setTotalAmount("299.99");
    setCostAmount("165.00");
    setItemsCount("2");
    setNewOrderStatus("PENDING");
    setShowOrderModal(false);

    toast.success(
      `Pedido creado exitosamente para ${optimisticOrder.customerName}`
    );

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

      setOrders((prev) =>
        prev.map((o) => (o.id === optimisticId ? createdOrder : o))
      );
    } catch {
      setOrders((prev) => prev.filter((o) => o.id !== optimisticId));
      toast.error("No se pudo guardar el pedido. Intenta nuevamente.");
    }
  }

  // Create Product
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
        validation.error.issues[0]?.message || "Verifica los datos del producto";
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
      toast.success(`Producto "${json.data.name}" agregado al catálogo`);
    } catch {
      toast.error("No se pudo agregar el producto. Verifica que el SKU sea único.");
    }
  }

  // Bulk Update
  async function handleBulkStatusUpdate() {
    if (selectedOrderIds.length < 2) return;

    const previousOrders = [...orders];
    const idsToUpdate = [...selectedOrderIds];
    const targetStatus = bulkTargetStatus;

    setOrders((prev) =>
      prev.map((order) =>
        idsToUpdate.includes(order.id)
          ? { ...order, status: targetStatus }
          : order
      )
    );
    setSelectedOrderIds([]);

    toast.success(
      `${idsToUpdate.length} pedidos actualizados a ${STATUS_LABELS[targetStatus] || targetStatus}`
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
        throw new Error("Fallo al actualizar pedidos");
      }
    } catch {
      setOrders(previousOrders);
      toast.error("No se pudieron actualizar los pedidos seleccionados.");
    }
  }

  // Restore sample data
  async function handleResetData() {
    setIsResetting(true);
    try {
      const res = await fetch("/api/test/reset-data", { method: "POST" });
      if (!res.ok) throw new Error("Error resetting data");

      const analyticsRes = await fetch("/api/test/analytics?page=1&limit=100");
      const analyticsJson = await analyticsRes.json();
      setOrders(analyticsJson.data || []);
      setSelectedOrderIds([]);
      toast.success("Datos de demostración restaurados");
    } catch {
      toast.error("No se pudieron restaurar los datos");
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
      <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-8 space-y-8">
        <KpiCardsSkeleton />
        <KanbanBoardSkeleton />
        <OrdersTableSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Material Design 3 Navigation Drawer (Left Rail) */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white p-4 lg:flex">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-900">
                OmniMarket
              </span>
              <span className="block text-xs text-slate-500">
                Panel de tienda
              </span>
            </div>
          </div>

          {/* Material 3 Navigation Pills */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveNav("all")}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                activeNav === "all"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Vista general
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav("all");
                document
                  .getElementById("section-kanban")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <span className="flex items-center gap-3">
                <Kanban className="h-4 w-4" />
                Envíos en curso
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {orders.filter((o) => o.status !== "DELIVERED").length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav("all");
                document
                  .getElementById("section-orders")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <span className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4" />
                Pedidos
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav("all");
                document
                  .getElementById("section-catalog")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <span className="flex items-center gap-3">
                <Boxes className="h-4 w-4" />
                Catálogo
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {products.length}
              </span>
            </button>
          </nav>
        </div>

        {/* User Account Card in Drawer Footer */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {currentUser.image ? (
                <img
                  src={currentUser.image}
                  alt={currentUser.name}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {currentUser.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Material Design 3 Top App Bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                OmniMarket — Operations Hub
              </h1>
              <p className="text-xs text-slate-500">
                Resumen de ventas, entregas y pedidos del día
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Account Pill visible on all screens */}
              <div
                data-testid="user-account-info"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-3"
              >
                {currentUser.image ? (
                  <img
                    src={currentUser.image}
                    alt={currentUser.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-medium">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700">
                  {currentUser.name}
                </span>
              </div>

              <button
                type="button"
                data-testid="reset-data-btn"
                onClick={handleResetData}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                title="Restaurar datos de ejemplo"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                Restaurar
              </button>

              <button
                type="button"
                data-testid="open-create-product-btn"
                onClick={() => setShowProductModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                <Package className="h-4 w-4" />
                Agregar producto
              </button>

              <button
                type="button"
                data-testid="open-create-order-btn"
                onClick={() => setShowOrderModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo pedido
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 lg:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-5">
          {/* 1. Material 3 Metric Summary Cards */}
          <section aria-label="Resumen de ventas">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div
                data-testid="kpi-total-revenue"
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Ventas totales
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Ingresos brutos acumulados
                </p>
              </div>

              <div
                data-testid="kpi-average-ticket"
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Compra promedio
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(metrics.averageTicket)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Importe medio por pedido
                </p>
              </div>

              <div
                data-testid="kpi-profit-margin"
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Margen neto
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Percent className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {metrics.profitMargin}%
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Rentabilidad sobre ventas
                </p>
              </div>

              <div
                data-testid="kpi-total-orders"
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Pedidos activos
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {metrics.totalOrders}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {products.length} productos en catálogo
                </p>
              </div>
            </div>
          </section>

          {/* 2. Kanban Board (Seguimiento de Envíos) */}
          <section
            id="section-kanban"
            aria-label="Seguimiento de envíos"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Seguimiento de envíos
                </h2>
                <p className="text-xs text-slate-500">
                  Mueve las tarjetas para actualizar la etapa de entrega de cada
                  pedido
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
                        mouseDownOrderIdRef.current ||
                        draggedOrderId ||
                        e.dataTransfer?.getData("text/plain");
                      if (transferredId) {
                        handleMoveOrder(transferredId, col.status);
                      }
                    }}
                    className={`flex max-h-[380px] flex-col rounded-2xl border p-3.5 transition ${
                      isDropTarget
                        ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                        : "border-slate-200/80 bg-slate-100/70"
                    }`}
                  >
                    {/* Column Header */}
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`}
                        />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {col.title}
                        </h3>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
                        {columnOrders.length}
                      </span>
                    </div>

                    {/* Cards List */}
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
                            onMouseDown={() => {
                              mouseDownOrderIdRef.current = order.id;
                              setDraggedOrderId(order.id);
                            }}
                            onDragStart={(e) => {
                              const activeOrderId =
                                mouseDownOrderIdRef.current || order.id;
                              setDraggedOrderId(activeOrderId);
                              if (e.dataTransfer) {
                                e.dataTransfer.setData(
                                  "text/plain",
                                  activeOrderId
                                );
                                e.dataTransfer.effectAllowed = "move";
                              }
                            }}
                            onDragEnd={() => {
                              mouseDownOrderIdRef.current = null;
                              setDraggedOrderId(null);
                              setDragOverColumn(null);
                            }}
                            className="group cursor-grab rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition hover:border-indigo-300 hover:shadow-md active:cursor-grabbing"
                          >
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500" />
                                #{order.id.replace("order-", "")}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {formatCurrency(order.totalAmount)}
                              </span>
                            </div>
                            <p className="mt-1.5 truncate text-sm font-semibold text-slate-800">
                              {order.customerName}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                              <span className="truncate max-w-[140px]">
                                {order.customerEmail}
                              </span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                                {order.itemsCount}{" "}
                                {order.itemsCount === 1 ? "art." : "arts."}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {columnOrders.length === 0 && (
                        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 text-xs text-slate-400">
                          Sin pedidos en esta etapa
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Orders Data Table (Material 3 Surface Card) */}
          <section
            id="section-orders"
            aria-label="Listado de pedidos"
            className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
          >
            {/* Table Toolbar */}
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Historial de pedidos
                </h2>
                <p className="text-xs text-slate-500">
                  Consulta, filtra o selecciona varios pedidos para cambiar su
                  estado
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    data-testid="search-orders-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente, correo o #..."
                    className="w-64 rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Status Filter Select (kept for E2E compatibility & quick filtering) */}
                <select
                  data-testid="filter-status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">Todas las etapas</option>
                  <option value="PENDING">Por confirmar</option>
                  <option value="PROCESSING">En preparación</option>
                  <option value="SHIPPED">En camino</option>
                  <option value="DELIVERED">Entregados</option>
                </select>
              </div>
            </div>

            {/* Contextual Action Bar when 2+ orders are selected */}
            {selectedOrderIds.length >= 2 && (
              <div
                data-testid="bulk-update-bar"
                className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-indigo-600 px-5 py-3 text-white shadow-md shadow-indigo-600/15"
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 font-bold">
                    {selectedOrderIds.length}
                  </span>
                  <span>pedidos seleccionados</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    data-testid="bulk-status-select"
                    value={bulkTargetStatus}
                    onChange={(e) =>
                      setBulkTargetStatus(e.target.value as OrderStatus)
                    }
                    className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white focus:outline-none"
                  >
                    <option value="PENDING" className="text-slate-900">
                      Marcar como: Por confirmar
                    </option>
                    <option value="PROCESSING" className="text-slate-900">
                      Marcar como: En preparación
                    </option>
                    <option value="SHIPPED" className="text-slate-900">
                      Marcar como: En camino
                    </option>
                    <option value="DELIVERED" className="text-slate-900">
                      Marcar como: Entregado
                    </option>
                  </select>

                  <button
                    type="button"
                    data-testid="apply-bulk-update-btn"
                    onClick={handleBulkStatusUpdate}
                    className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Aplicar cambio
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    className="px-2 text-xs text-indigo-100 hover:text-white"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                data-testid="orders-table"
              >
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-12 px-5 py-3.5">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={
                          filteredOrders.length > 0 &&
                          selectedOrderIds.length === filteredOrders.length
                        }
                        onChange={toggleSelectAllFiltered}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3.5">Pedido</th>
                    <th className="px-4 py-3.5">Cliente</th>
                    <th className="px-4 py-3.5">Artículos</th>
                    <th className="px-4 py-3.5">Total</th>
                    <th className="px-4 py-3.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    const columnMeta =
                      KANBAN_COLUMNS.find((c) => c.status === order.status) ||
                      KANBAN_COLUMNS[0];

                    return (
                      <tr
                        key={order.id}
                        data-testid={`table-row-${order.id}`}
                        className={`transition hover:bg-slate-50/80 ${
                          isSelected ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            data-testid={`select-order-${order.id}`}
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">
                          {order.id}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {order.customerEmail}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {order.itemsCount}{" "}
                          {order.itemsCount === 1 ? "unidad" : "unidades"}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${columnMeta.pillClass}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${columnMeta.dotColor}`}
                            />
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Products Catalog Section */}
          <section
            id="section-catalog"
            aria-label="Catálogo de productos"
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Inventario de productos
                </h2>
                <p className="text-xs text-slate-500">
                  Artículos disponibles actualmente en tienda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                + Nuevo artículo
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, 6).map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {prod.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {prod.category} • {prod.sku}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(prod.price)}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-600">
                      {prod.stock} disponibles
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Material 3 Dialog: Create Order */}
      {showOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          data-testid="create-order-modal"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Nuevo pedido
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresa los datos de la venta para registrarla
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {orderFormError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
                  {orderFormError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nombre del cliente
                </label>
                <input
                  type="text"
                  required
                  data-testid="input-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. Valeria Montes"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  data-testid="input-customer-email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="cliente@correo.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Importe total (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-testid="input-total-amount"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Costo (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-testid="input-cost-amount"
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Cantidad de artículos
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    data-testid="input-items-count"
                    value={itemsCount}
                    onChange={(e) => setItemsCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Etapa inicial
                  </label>
                  <select
                    data-testid="select-order-status"
                    value={newOrderStatus}
                    onChange={(e) =>
                      setNewOrderStatus(e.target.value as OrderStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="PENDING">Por confirmar</option>
                    <option value="PROCESSING">En preparación</option>
                    <option value="SHIPPED">En camino</option>
                    <option value="DELIVERED">Entregado</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-order-btn"
                  className="rounded-full bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Crear pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material 3 Dialog: Create Product */}
      {showProductModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          data-testid="create-product-modal"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Agregar producto
                </h3>
                <p className="text-xs text-slate-500">
                  Registra un nuevo artículo en tu catálogo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {productFormError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
                  {productFormError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nombre del artículo
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ej. Teclado inalámbrico Pro"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={productSku}
                    onChange={(e) => setProductSku(e.target.value)}
                    placeholder="OMNI-999"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Categoría
                  </label>
                  <input
                    type="text"
                    required
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Precio
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Costo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Stock
                  </label>
                  <input
                    type="number"
                    required
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Guardar producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
