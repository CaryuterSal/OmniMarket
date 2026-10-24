import { describe, it, expect } from "vitest";
import {
  calculateAverageTicket,
  calculateProfitMargin,
  formatCurrency,
  OrderInputSchema,
  filterOrders,
} from "../analytics-utils";

describe("OmniMarket Analytics & Validation Unit Tests", () => {
  // Test 1: Cálculo de ticket promedio con lista normal
  it("Test 1: calcula correctamente el ticket promedio con una lista normal de pedidos", () => {
    const orders = [
      { totalAmount: 100 },
      { totalAmount: 250.5 },
      { totalAmount: 149.5 },
    ];
    expect(calculateAverageTicket(orders)).toBe(166.67);
  });

  // Test 2: Cálculo de ticket promedio con arreglo vacío (manejo de división por cero)
  it("Test 2: retorna 0 al calcular el ticket promedio con un arreglo vacío evitando división por cero", () => {
    expect(calculateAverageTicket([])).toBe(0);
  });

  // Test 3: Cálculo de margen de ganancia porcentual con valores positivos
  it("Test 3: calcula el margen de ganancia porcentual con ingresos y costos positivos", () => {
    // (1000 - 650) / 1000 * 100 = 35%
    expect(calculateProfitMargin(1000, 650)).toBe(35);
  });

  // Test 4: Cálculo de margen de ganancia porcentual con ingresos en 0
  it("Test 4: retorna 0 en el cálculo de margen de ganancia cuando los ingresos son 0 o negativos", () => {
    expect(calculateProfitMargin(0, 200)).toBe(0);
    expect(calculateProfitMargin(-100, 50)).toBe(0);
  });

  // Test 5: Formateador de moneda para montos enteros y decimales
  it("Test 5: formatea correctamente montos enteros y decimales en formato USD", () => {
    expect(formatCurrency(1250)).toBe("$1,250.00");
    expect(formatCurrency(99.95)).toBe("$99.95");
  });

  // Test 6: Formateador de moneda para números negativos y cero
  it("Test 6: formatea correctamente números negativos y el valor cero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-45.5)).toBe("-$45.50");
  });

  // Test 7: Validación de esquema Zod (OrderInputSchema) con un pedido válido
  it("Test 7: valida exitosamente un objeto de pedido válido con OrderInputSchema", () => {
    const validOrder = {
      customerName: "Elena Rostova",
      customerEmail: "elena@omnimarket.io",
      totalAmount: 320.0,
      costAmount: 180.0,
      status: "PENDING",
      itemsCount: 3,
    };
    const result = OrderInputSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  // Test 8: Validación de esquema Zod rechazando monto negativo
  it("Test 8: rechaza un pedido cuando el monto total es negativo o cero en OrderInputSchema", () => {
    const invalidOrder = {
      customerName: "Carlos Méndez",
      customerEmail: "carlos@omnimarket.io",
      totalAmount: -50,
      costAmount: 20,
      status: "PENDING",
      itemsCount: 1,
    };
    const result = OrderInputSchema.safeParse(invalidOrder);
    expect(result.success).toBe(false);
  });

  // Test 9: Validación de esquema Zod rechazando email o estado inválido
  it("Test 9: rechaza un pedido con email mal formado o estado fuera del enum permitido", () => {
    const invalidEmailOrder = {
      customerName: "Ana Torres",
      customerEmail: "correo-invalido-sin-arroba",
      totalAmount: 150,
      costAmount: 90,
      status: "INVALID_STATUS",
      itemsCount: 2,
    };
    const result = OrderInputSchema.safeParse(invalidEmailOrder);
    expect(result.success).toBe(false);
  });

  // Test 10: Función pura de filtrado y búsqueda (filterOrders) por estado y nombre de cliente
  it("Test 10: filtra pedidos de forma pura combinando estado y búsqueda por nombre de cliente", () => {
    const sampleOrders = [
      { id: "order-1", customerName: "Alice Johnson", status: "PENDING" },
      { id: "order-2", customerName: "Bob Smith", status: "SHIPPED" },
      { id: "order-3", customerName: "Alice Cooper", status: "SHIPPED" },
    ];

    const filteredByStatusAndName = filterOrders(sampleOrders, {
      status: "SHIPPED",
      search: "alice",
    });

    expect(filteredByStatusAndName).toHaveLength(1);
    expect(filteredByStatusAndName[0].id).toBe("order-3");
  });
});
