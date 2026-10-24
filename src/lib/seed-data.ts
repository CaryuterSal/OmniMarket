import { prisma } from "./prisma";
import type { OrderStatus } from "./analytics-utils";

const CUSTOMERS = [
  { name: "Elena Rostova", email: "elena.rostova@omnimarket.io" },
  { name: "Marco Aurelio", email: "marco.aurelio@omnimarket.io" },
  { name: "Sofía Vergara", email: "sofia.vergara@omnimarket.io" },
  { name: "Liam O'Connor", email: "liam.oconnor@omnimarket.io" },
  { name: "Hana Takahashi", email: "hana.takahashi@omnimarket.io" },
  { name: "Mateo Silva", email: "mateo.silva@omnimarket.io" },
  { name: "Camila Mendoza", email: "camila.mendoza@omnimarket.io" },
  { name: "Lucas Sterling", email: "lucas.sterling@omnimarket.io" },
  { name: "Valeria Ríos", email: "valeria.rios@omnimarket.io" },
  { name: "David Kim", email: "david.kim@omnimarket.io" },
  { name: "Isabella Rossi", email: "isabella.rossi@omnimarket.io" },
  { name: "Sebastián Mora", email: "sebastian.mora@omnimarket.io" },
];

const REALISTIC_PRODUCTS = [
  { name: "Monitor UltraWide 34\" Pro", sku: "OMNI-MON-001", price: 699.99, cost: 420.0, stock: 34, category: "Monitors" },
  { name: "Teclado Mecánico RGB Wireless", sku: "OMNI-KEY-002", price: 149.5, cost: 75.0, stock: 85, category: "Peripherals" },
  { name: "Mouse Ergonómico Laser Pro", sku: "OMNI-MOU-003", price: 89.99, cost: 40.0, stock: 120, category: "Peripherals" },
  { name: "Laptop Workstation X1 Carbon", sku: "OMNI-LAP-004", price: 1899.0, cost: 1320.0, stock: 18, category: "Computing" },
  { name: "Docking Station Thunderbolt 4", sku: "OMNI-DOC-005", price: 249.0, cost: 135.0, stock: 45, category: "Accessories" },
  { name: "Auriculares ANC Studio Max", sku: "OMNI-AUD-006", price: 329.0, cost: 170.0, stock: 60, category: "Audio" },
  { name: "Silla Ergonómica Mesh Ejecutiva", sku: "OMNI-CHR-007", price: 459.0, cost: 240.0, stock: 25, category: "Furniture" },
  { name: "Webcam 4K AI AutoFraming", sku: "OMNI-CAM-008", price: 179.99, cost: 92.0, stock: 74, category: "Video" },
  { name: "Micrófono Condensador USB-C", sku: "OMNI-MIC-009", price: 129.0, cost: 64.0, stock: 90, category: "Audio" },
  { name: "SSD NVMe Gen5 2TB Heatsink", sku: "OMNI-SSD-010", price: 219.99, cost: 125.0, stock: 110, category: "Storage" },
  { name: "Router Wi-Fi 7 Tri-Band Mesh", sku: "OMNI-NET-011", price: 399.0, cost: 230.0, stock: 30, category: "Networking" },
  { name: "Tablet Pro 12.9\" OLED 256GB", sku: "OMNI-TAB-012", price: 999.0, cost: 670.0, stock: 28, category: "Mobile" },
  { name: "Soporte Hidráulico Doble Monitor", sku: "OMNI-ARM-013", price: 115.0, cost: 52.0, stock: 67, category: "Accessories" },
  { name: "Fuente de Poder UPS 1500VA", sku: "OMNI-UPS-014", price: 259.99, cost: 155.0, stock: 40, category: "Power" },
  { name: "Escritorio Elevable Dual Motor", sku: "OMNI-DSK-015", price: 589.0, cost: 340.0, stock: 15, category: "Furniture" },
];

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

function buildDeterministicOrders(count: number) {
  const now = Date.now();
  const orders = [];

  for (let i = 1; i <= count; i++) {
    const customer = CUSTOMERS[(i - 1) % CUSTOMERS.length];
    const status: OrderStatus =
      i <= 3 ? "PENDING" : STATUSES[(i - 1) % STATUSES.length];
    const itemsCount = ((i * 2) % 5) + 1;
    const totalAmount = Number((120 + i * 18.5).toFixed(2));
    const costAmount = Number((totalAmount * 0.62).toFixed(2));
    // Ensure order-1, order-2, order-3 are the newest orders so they appear first when sorted DESC
    const createdAt = new Date(now - i * 60 * 1000);

    orders.push({
      id: `order-${i}`,
      customerName: customer.name,
      customerEmail: customer.email,
      totalAmount,
      costAmount,
      status,
      itemsCount,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return orders;
}

function buildDeterministicProducts(count: number) {
  const now = Date.now();
  return REALISTIC_PRODUCTS.slice(0, count).map((prod, idx) => ({
    id: `product-${idx + 1}`,
    name: prod.name,
    sku: prod.sku,
    price: prod.price,
    cost: prod.cost,
    stock: prod.stock,
    category: prod.category,
    createdAt: new Date(now - idx * 120 * 1000),
  }));
}

/**
 * Inicializa la base de datos con 60 pedidos y 15 productos realistas si está vacía,
 * o cuando se invoca desde el script de seed.
 */
export async function seedInitialData(forceReset = false) {
  if (!forceReset) {
    const existingOrders = await prisma.order.count();
    if (existingOrders > 0) {
      return { seeded: false, ordersCount: existingOrders };
    }
  }

  const ordersData = buildDeterministicOrders(60);
  const productsData = buildDeterministicProducts(15);

  await prisma.$transaction([
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.order.createMany({ data: ordersData }),
    prisma.product.createMany({ data: productsData }),
  ]);

  return {
    seeded: true,
    ordersCount: ordersData.length,
    productsCount: productsData.length,
  };
}

/**
 * Resetea la base de datos e inserta exactamente 50 pedidos deterministas
 * (incluyendo order-1, order-2, order-3 en PENDING) y 10 productos para pruebas E2E.
 */
export async function resetDeterministicTestData() {
  const ordersData = buildDeterministicOrders(50);
  const productsData = buildDeterministicProducts(10);

  await prisma.$transaction([
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.order.createMany({ data: ordersData }),
    prisma.product.createMany({ data: productsData }),
  ]);

  return {
    ordersCount: ordersData.length,
    productsCount: productsData.length,
  };
}
