import { test, expect } from "@playwright/test";

test.describe("OmniMarket - Operations Hub E2E Suite", () => {
  // Flujo 1: Autenticación y Rutas Protegidas
  test("Flujo 1 (Autenticación): redirige a /login sin sesión y permite acceso a /dashboard con cookie de sesión", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("oauth-google-btn")).toBeVisible();
    await expect(page.getByTestId("oauth-github-btn")).toBeVisible();

    // Inyectar cookie de sesión simulada E2E
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

  // Flujo 2: Creación de Pedido + Toast + Reflejo en Tabla
  test("Flujo 2 (Creación): resetea datos, crea un nuevo pedido en /dashboard, verifica Toast y presencia en la tabla", async ({
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

    // Abrir modal de Nuevo Pedido
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

    // Verificar Toast de confirmación (sonner)
    await expect(
      page.getByText(/Pedido creado exitosamente/i)
    ).toBeVisible();

    // Comprobar que el nuevo pedido aparece en la tabla
    const ordersTable = page.getByTestId("orders-table");
    await expect(ordersTable).toContainText(uniqueCustomer);
    await expect(ordersTable).toContainText("e2e.hackathon@omnimarket.io");
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

    // Verificar que #order-1 inicia en la columna PENDING
    await expect(pendingColumn.locator("#order-1")).toBeVisible();

    // Arrastrar #order-1 hacia la columna SHIPPED
    await page.dragAndDrop("#order-1", '[data-testid="column-SHIPPED"]');

    // Verificar que #order-1 cambió a la columna SHIPPED en el DOM inmediatamente
    await expect(shippedColumn.locator("#order-1")).toBeVisible();

    // Consultar endpoint de auditoría para confirmar persistencia en BD
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
