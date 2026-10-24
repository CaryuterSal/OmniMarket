import { z } from "zod";

export const OrderStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
]);

export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export interface OrderRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  costAmount: number;
  status: OrderStatus | string;
  itemsCount: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export const OrderInputSchema = z.object({
  customerName: z.string().min(2, "El nombre del cliente es obligatorio"),
  customerEmail: z.string().email("Correo electrónico inválido"),
  totalAmount: z.number().positive("El monto total debe ser mayor a 0"),
  costAmount: z.number().nonnegative("El costo no puede ser negativo"),
  status: OrderStatusEnum.default("PENDING"),
  itemsCount: z.number().int().positive("La cantidad de items debe ser al menos 1").default(1),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export const ProductInputSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio"),
  sku: z.string().min(2, "El SKU es obligatorio"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  cost: z.number().nonnegative("El costo no puede ser negativo"),
  stock: z.number().int().nonnegative("El stock no puede ser negativo"),
  category: z.string().min(2, "La categoría es obligatoria"),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export const BulkOrderUpdateSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, "Seleccione al menos un pedido"),
  status: OrderStatusEnum,
});

/**
 * Calcula el ticket promedio a partir de un listado de pedidos o montos.
 * Retorna 0 si el arreglo está vacío para evitar división por cero.
 */
export function calculateAverageTicket(
  orders: Array<{ totalAmount: number } | number>
): number {
  if (!orders || orders.length === 0) {
    return 0;
  }
  const sum = orders.reduce<number>((acc, item) => {
    const amount = typeof item === "number" ? item : item.totalAmount;
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return Number((sum / orders.length).toFixed(2));
}

/**
 * Calcula el margen de ganancia porcentual: ((revenue - cost) / revenue) * 100
 * Retorna 0 si revenue <= 0.
 */
export function calculateProfitMargin(
  totalRevenue: number,
  totalCost: number
): number {
  if (!Number.isFinite(totalRevenue) || totalRevenue <= 0) {
    return 0;
  }
  const margin = ((totalRevenue - totalCost) / totalRevenue) * 100;
  return Number(margin.toFixed(2));
}

/**
 * Formatea un monto numérico como moneda USD ($1,234.56 o -$50.00).
 */
export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Filtra pedidos de forma pura por estado ('ALL' o estado específico) y término de búsqueda
 * (nombre de cliente, email o ID).
 */
export function filterOrders<
  T extends {
    id?: string;
    customerName: string;
    customerEmail?: string;
    status: string;
  }
>(
  orders: T[],
  filters: { status?: string; search?: string }
): T[] {
  if (!orders || orders.length === 0) return [];

  const statusFilter = filters.status?.trim().toUpperCase();
  const searchQuery = filters.search?.trim().toLowerCase() ?? "";

  return orders.filter((order) => {
    const matchesStatus =
      !statusFilter ||
      statusFilter === "ALL" ||
      order.status.toUpperCase() === statusFilter;

    const matchesSearch =
      searchQuery === "" ||
      order.customerName.toLowerCase().includes(searchQuery) ||
      (order.customerEmail &&
        order.customerEmail.toLowerCase().includes(searchQuery)) ||
      (order.id && order.id.toLowerCase().includes(searchQuery));

    return matchesStatus && matchesSearch;
  });
}
