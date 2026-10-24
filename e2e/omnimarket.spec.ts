import { test, expect } from "@playwright/test";

test.describe("OmniMarket - Operations Hub E2E Suite", () => {
  // Flujo 1: Autenticación OAuth 2.0 Exclusiva y Rutas Protegidas
  test("Flujo 1 (Autenticación): redirige a /login con botones exclusivos OAuth 2.0 sin sesión y permite acceso autenticado a /dashboard", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("oauth-google-btn")).toBeVisible();
    await expect(page.getByTestId("oauth-github-btn")).toBeVisible();
    await expect(page.getByTestId("demo-bypass-login-btn")).toHaveCount(0);

    // Inyectar cookie de sesión para entorno de pruebas E2E
    await context.addCookies([
      {
        name: "x-e2e-test-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /OmniMarket — Operations Hub/i })
    ).toBeVisible();
  });

  // Flujo 2: Creación de Nuevo Pedido y Nuevo Producto + Toast + Reflejo en Tablas
  test("Flujo 2 (Creación): registra nuevo pedido y nuevo producto en /dashboard, verifica Toasts y reflejo inmediato en las tablas", async ({
    page,
    context,
    request,
  }) => {
    const resetRes = await request.post("/api/test/reset-data");
    expect(resetRes.ok()).toBeTruthy();

    await context.addCookies([
      {
        name: "x-e2e-test-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");

    // 1. Crear nuevo pedido y verificar reflejo en orders-table
    await page.getByTestId("open-create-order-btn").click();
    await expect(page.getByTestId("create-order-modal")).toBeVisible();

    const uniqueCustomer = "Cliente Hackathon E2E";
    await page.getByTestId("input-customer-name").fill(uniqueCustomer);
    await page
      .getByTestId("input-customer-email")
      .fill("e2e.hackathon@omnimarket.io");
    await page.getByTestId("input-total-amount").fill("480.00");
    await page.getByTestId("input-cost-amount").fill("250.00");
    await page.getByTestId("input-items-count").fill("4");

    await page.getByTestId("submit-create-order-btn").click();

    await expect(
      page.getByText(/Pedido creado exitosamente/i)
    ).toBeVisible();

    const ordersTable = page.getByTestId("orders-table");
    await expect(ordersTable).toContainText(uniqueCustomer);
    await expect(ordersTable).toContainText("e2e.hackathon@omnimarket.io");

    // 2. Crear nuevo producto y verificar reflejo en products-table
    await page.getByTestId("open-create-product-btn").click();
    await expect(page.getByTestId("create-product-modal")).toBeVisible();

    const uniqueProductName = "Monitor OLED Hackathon E2E";
    const uniqueSku = "OMNI-E2E-999";

    await page.getByTestId("input-product-name").fill(uniqueProductName);
    await page.getByTestId("input-product-sku").fill(uniqueSku);
    await page.getByTestId("input-product-category").fill("Monitors");
    await page.getByTestId("input-product-price").fill("899.99");
    await page.getByTestId("input-product-cost").fill("520.00");
    await page.getByTestId("input-product-stock").fill("30");

    await page.getByTestId("submit-create-product-btn").click();

    await expect(
      page.getByText(/agregado al catálogo/i)
    ).toBeVisible();

    const productsTable = page.getByTestId("products-table");
    await expect(productsTable).toContainText(uniqueProductName);
    await expect(productsTable).toContainText(uniqueSku);
  });

  // Flujo 3: Drag & Drop en Kanban con Persistencia Optimista y Verificación API
  test("Flujo 3 (Drag & Drop): resetea datos, arrastra #order-1 de PENDING a SHIPPED y verifica persistencia en /api/test/kanban-status", async ({
    page,
    context,
    request,
  }) => {
    const resetRes = await request.post("/api/test/reset-data");
    expect(resetRes.ok()).toBeTruthy();

    await context.addCookies([
      {
        name: "x-e2e-test-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");

    const pendingColumn = page.getByTestId("column-PENDING");
    const shippedColumn = page.getByTestId("column-SHIPPED");

    await expect(pendingColumn.locator("#order-1")).toBeVisible();

    await page.dragAndDrop("#order-1", '[data-testid="column-SHIPPED"]');

    await expect(shippedColumn.locator("#order-1")).toBeVisible();

    await expect
      .poll(
        async () => {
          const statusRes = await request.get(
            "/api/test/kanban-status?orderId=order-1"
          );
          const statusJson = await statusRes.json();
          return statusJson.status;
        },
        { timeout: 5000 }
      )
      .toBe("SHIPPED");
  });
});
