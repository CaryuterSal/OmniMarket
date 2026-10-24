"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Store,
  BarChart3,
  Kanban,
  ClipboardList,
  Boxes,
  User,
  MoreVertical,
  ChevronRight,
  Mail,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  ArrowUpRight,
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

type ActiveView = "kanban" | "orders" | "analytics" | "catalog";

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

const VIEW_METADATA: Record<
  ActiveView,
  { title: string; subtitle: string }
> = {
  kanban: {
    title: "Tablero de envíos",
    subtitle: "Organiza y avanza los pedidos según su etapa de entrega",
  },
  orders: {
    title: "Historial de pedidos",
    subtitle: "Consulta el listado completo, filtra y edita en lote",
  },
  analytics: {
    title: "Resumen de negocio",
    subtitle: "Indicadores financieros y distribución de ventas",
  },
  catalog: {
    title: "Catálogo de productos",
    subtitle: "Administra tus artículos, precios y existencias",
  },
};

export default function DashboardClient({
  initialOrders,
  initialProducts,
  currentUser,
}: DashboardClientProps) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts);
  const [isResetting, setIsResetting] = useState(false);

  // Navigation View State (separate screens instead of stacked page)
  const [activeView, setActiveView] = useState<ActiveView>("kanban");

  // Topbar Dropdown Menus State
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Detail Drawer State (Slide-over side sheet for order details)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

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

  // Close topbar dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(e.target as Node)
      ) {
        setActionsMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selected Order for Detail Drawer
  const selectedDetailOrder = useMemo(
    () => orders.find((o) => o.id === detailOrderId) || null,
    [orders, detailOrderId]
  );

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
      totalCost,
      netProfit: Number((totalRevenue - totalCost).toFixed(2)),
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

  // Move order across columns or from Detail Drawer
  async function handleMoveOrder(orderId: string, targetStatus: OrderStatus) {
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
      `Pedido ${orderId} movido a ${STATUS_LABELS[targetStatus] || targetStatus}`
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
        `No se pudo actualizar el pedido ${orderId}. Se restauró su estado.`
      );
    }
  }

  // Delete order from Detail View
  async function handleDeleteOrder(orderId: string) {
    const previousOrders = [...orders];
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setDetailOrderId(null);
    toast.success(`Pedido ${orderId} eliminado`);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch {
      setOrders(previousOrders);
      toast.error("No se pudo eliminar el pedido");
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

      // Navigate to Orders view so the user immediately sees the new record in the table
      setActiveView("orders");

      toast.success(
        `Pedido creado exitosamente para ${createdOrder.customerName}`
      );
    } catch {
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
        validation.error.issues[0]?.message ||
        "Verifica los datos del producto";
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
      setActiveView("catalog");
      toast.success(`Producto "${json.data.name}" agregado al catálogo`);
    } catch {
      toast.error(
        "No se pudo agregar el producto. Verifica que el SKU sea único."
      );
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
    setActionsMenuOpen(false);
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
      {/* Material Design 3 Navigation Drawer */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white p-4 lg:flex">
        <div className="space-y-6">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">
                OmniMarket — Operations Hub
              </h1>
              <span className="block text-[11px] text-slate-500">
                Centro de operaciones
              </span>
            </div>
          </div>

          {/* Dedicated View Navigation Items */}
          <nav className="space-y-1" aria-label="Navegación principal">
            <button
              type="button"
              data-testid="nav-kanban"
              onClick={() => setActiveView("kanban")}
              className={`flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm transition ${
                activeView === "kanban"
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "font-medium text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <Kanban className="h-4 w-4" />
                Envíos
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeView === "kanban"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {orders.filter((o) => o.status !== "DELIVERED").length}
              </span>
            </button>

            <button
              type="button"
              data-testid="nav-orders"
              onClick={() => setActiveView("orders")}
              className={`flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm transition ${
                activeView === "orders"
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "font-medium text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4" />
                Pedidos
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeView === "orders"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              data-testid="nav-catalog"
              onClick={() => setActiveView("catalog")}
              className={`flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm transition ${
                activeView === "catalog"
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "font-medium text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <Boxes className="h-4 w-4" />
                Catálogo
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeView === "catalog"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {products.length}
              </span>
            </button>

            <button
              type="button"
              data-testid="nav-analytics"
              onClick={() => setActiveView("analytics")}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${
                activeView === "analytics"
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "font-medium text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Finanzas y resumen
            </button>
          </nav>
        </div>

        {/* Persistent User Account & Logout Card in Sidebar Footer */}
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
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
              className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Material Design 3 Top App Bar with Grouped Menus */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            {/* Left: Current View Title & Mobile View Switcher */}
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {VIEW_METADATA[activeView].title}
                </h2>
                <p className="hidden text-xs text-slate-500 sm:block">
                  {VIEW_METADATA[activeView].subtitle}
                </p>
              </div>
            </div>

            {/* Center: Mobile/Tablet Segmented Navigation */}
            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 lg:hidden">
              {(["kanban", "orders", "catalog", "analytics"] as ActiveView[]).map(
                (view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setActiveView(view)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      activeView === view
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {view === "kanban"
                      ? "Envíos"
                      : view === "orders"
                      ? "Pedidos"
                      : view === "catalog"
                      ? "Catálogo"
                      : "Resumen"}
                  </button>
                )
              )}
            </div>

            {/* Right: Primary CTA + Grouped Overflow Menu + User Account Menu */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="open-create-order-btn"
                onClick={() => setShowOrderModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo pedido</span>
              </button>

              {/* More Actions Dropdown Menu (⋮) */}
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  aria-label="Más opciones"
                  onClick={() => setActionsMenuOpen((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {actionsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      data-testid="open-create-product-btn"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setShowProductModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4 text-indigo-600" />
                      Agregar producto al catálogo
                    </button>

                    <div className="my-1 h-px bg-slate-100" />

                    <button
                      type="button"
                      data-testid="reset-data-btn"
                      onClick={handleResetData}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4 text-slate-400" />
                      Restaurar datos de ejemplo
                    </button>
                  </div>
                )}
              </div>

              {/* Account Dropdown Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  data-testid="user-account-info"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-3 transition hover:bg-slate-100"
                >
                  {currentUser.image ? (
                    <img
                      src={currentUser.image}
                      alt={currentUser.name}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[110px] truncate text-xs font-medium text-slate-700">
                    {currentUser.name}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {currentUser.email}
                      </p>
                      <span className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                        Cuenta {currentUser.provider || "Activa"}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setActiveView("analytics");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        Ver resumen de cuenta y tienda
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Active View Workspace */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
          {/* VIEW 1: KANBAN BOARD (ENVÍOS) */}
          {activeView === "kanban" && (
            <div className="space-y-5">
              {/* Compact Status Bar + Quick View Switch */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-[0_1px_2px_rgb(0,0,0,0.02)]">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Total en curso
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {orders.filter((o) => o.status !== "DELIVERED").length}{" "}
                      envíos activos
                    </p>
                  </div>
                  <div className="h-7 w-px bg-slate-100" />
                  <div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Entregados
                    </span>
                    <p className="text-sm font-bold text-emerald-600">
                      {orders.filter((o) => o.status === "DELIVERED").length}{" "}
                      completados
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView("orders")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Ver en formato tabla
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Kanban Columns */}
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
                          e.dataTransfer?.getData("text/plain") ||
                          draggedOrderId;
                        if (transferredId) {
                          handleMoveOrder(transferredId, col.status);
                        }
                      }}
                      className={`flex h-[calc(100vh-230px)] min-h-[480px] flex-col rounded-2xl border p-3.5 transition ${
                        isDropTarget
                          ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                          : "border-slate-200/80 bg-slate-100/70"
                      }`}
                    >
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
                              onClick={() => setDetailOrderId(order.id)}
                              onDragStart={(e) => {
                                setDraggedOrderId(order.id);
                                if (e.dataTransfer) {
                                  e.dataTransfer.setData(
                                    "text/plain",
                                    order.id
                                  );
                                  e.dataTransfer.effectAllowed = "move";
                                }
                              }}
                              onDragEnd={() => {
                                setDraggedOrderId(null);
                                setDragOverColumn(null);
                              }}
                              className="group cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition hover:border-indigo-300 hover:shadow-md active:cursor-grabbing"
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
                              <p className="mt-1.5 truncate text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                                {order.customerName}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                                <span className="max-w-[140px] truncate">
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
                          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 text-xs text-slate-400">
                            Sin pedidos en esta etapa
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: ORDERS DATA TABLE (PEDIDOS) */}
          {activeView === "orders" && (
            <section
              aria-label="Listado de pedidos"
              className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgb(0,0,0,0.02)]"
            >
              {/* Filter Chips & Search Bar */}
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: "ALL", label: "Todos" },
                    { key: "PENDING", label: "Por confirmar" },
                    { key: "PROCESSING", label: "En preparación" },
                    { key: "SHIPPED", label: "En camino" },
                    { key: "DELIVERED", label: "Entregados" },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setStatusFilter(chip.key)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        statusFilter === chip.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
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

                  <select
                    data-testid="filter-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">Todas las etapas</option>
                    <option value="PENDING">Por confirmar</option>
                    <option value="PROCESSING">En preparación</option>
                    <option value="SHIPPED">En camino</option>
                    <option value="DELIVERED">Entregados</option>
                  </select>
                </div>
              </div>

              {/* Contextual Action Bar when 2+ rows selected */}
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

              {/* Table */}
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
                      <th className="px-4 py-3.5 text-right">Detalle</th>
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
                          onClick={() => setDetailOrderId(order.id)}
                          className={`cursor-pointer transition hover:bg-slate-50/90 ${
                            isSelected ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          <td
                            className="px-5 py-3.5"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                              Ver
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW 3: CATALOG / INVENTORY VIEW */}
          {activeView === "catalog" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgb(0,0,0,0.02)]">
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Artículos registrados
                  </span>
                  <p className="text-lg font-bold text-slate-900">
                    {products.length} productos en inventario
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4" />
                  Agregar producto
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((prod) => {
                  const unitMargin = calculateProfitMargin(
                    prod.price,
                    prod.cost
                  );
                  return (
                    <div
                      key={prod.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0,0,0,0.02)] transition hover:border-indigo-200 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {prod.category}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {prod.sku}
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-bold text-slate-900">
                          {prod.name}
                        </h3>
                      </div>

                      <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
                        <div>
                          <span className="block text-[11px] text-slate-400">
                            Precio de venta
                          </span>
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrency(prod.price)}
                          </span>
                          <span className="ml-2 text-xs text-emerald-600 font-medium">
                            ({unitMargin}% margen)
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              prod.stock > 25
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {prod.stock} en stock
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: ANALYTICS & FINANCIAL SUMMARY */}
          {activeView === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div
                  data-testid="kpi-total-revenue"
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Ventas totales
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {formatCurrency(metrics.totalRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Utilidad neta: {formatCurrency(metrics.netProfit)}
                  </p>
                </div>

                <div
                  data-testid="kpi-average-ticket"
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Compra promedio
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {formatCurrency(metrics.averageTicket)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Por cada orden registrada
                  </p>
                </div>

                <div
                  data-testid="kpi-profit-margin"
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Margen neto
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Percent className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {metrics.profitMargin}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Costo total: {formatCurrency(metrics.totalCost)}
                  </p>
                </div>

                <div
                  data-testid="kpi-total-orders"
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Pedidos registrados
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {metrics.totalOrders}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {products.length} productos activos
                  </p>
                </div>
              </div>

              {/* Distribution by Stage */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900">
                  Distribución de pedidos por etapa
                </h3>
                <p className="text-xs text-slate-500">
                  Proporción actual de órdenes según su avance logístico
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {KANBAN_COLUMNS.map((col) => {
                    const count = orders.filter(
                      (o) => o.status === col.status
                    ).length;
                    const pct =
                      orders.length > 0
                        ? Math.round((count / orders.length) * 100)
                        : 0;
                    return (
                      <div
                        key={col.status}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">
                            {col.title}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${col.dotColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ORDER DETAIL SLIDE-OVER DRAWER (Material 3 Side Sheet) */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]">
          <div
            data-testid="order-detail-drawer"
            className="flex h-full w-full max-w-md flex-col justify-between bg-white p-6 shadow-2xl"
          >
            <div className="space-y-6 overflow-y-auto pr-1">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-semibold text-indigo-600">
                    Pedido #{selectedDetailOrder.id.replace("order-", "")}
                  </span>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                    {selectedDetailOrder.customerName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailOrderId(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stage Selector / Stepper */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Etapa del envío
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {KANBAN_COLUMNS.map((col) => {
                    const isCurrent =
                      selectedDetailOrder.status === col.status;
                    return (
                      <button
                        key={col.status}
                        type="button"
                        onClick={() =>
                          handleMoveOrder(selectedDetailOrder.id, col.status)
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                          isCurrent
                            ? "border-indigo-600 bg-indigo-50/80 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {col.status === "PENDING" && (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        {col.status === "PROCESSING" && (
                          <Package className="h-4 w-4 text-blue-600" />
                        )}
                        {col.status === "SHIPPED" && (
                          <Truck className="h-4 w-4 text-purple-600" />
                        )}
                        {col.status === "DELIVERED" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        <span>{col.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Datos del cliente
                </span>
                <div className="flex items-center gap-2.5 text-sm font-medium text-slate-800">
                  <User className="h-4 w-4 text-slate-400" />
                  {selectedDetailOrder.customerName}
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {selectedDetailOrder.customerEmail}
                </div>
                {selectedDetailOrder.createdAt && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-500">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    Registrado el{" "}
                    {new Date(selectedDetailOrder.createdAt).toLocaleDateString(
                      "es-ES",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </div>
                )}
              </div>

              {/* Financial Breakdown Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Desglose financiero
                </span>

                <div className="flex justify-between text-xs text-slate-600">
                  <span>Artículos incluidos</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDetailOrder.itemsCount} unidades
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-600">
                  <span>Costo operativo</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(selectedDetailOrder.costAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-600">
                  <span>Ganancia neta estimada</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(
                      selectedDetailOrder.totalAmount -
                        selectedDetailOrder.costAmount
                    )}{" "}
                    (
                    {calculateProfitMargin(
                      selectedDetailOrder.totalAmount,
                      selectedDetailOrder.costAmount
                    )}
                    %)
                  </span>
                </div>

                <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-900">
                    Importe total pagado
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(selectedDetailOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => handleDeleteOrder(selectedDetailOrder.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar pedido
              </button>

              <button
                type="button"
                onClick={() => setDetailOrderId(null)}
                className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
