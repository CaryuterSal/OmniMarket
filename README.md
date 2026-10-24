# OmniMarket — Operations Hub

[![OmniMarket CI/CD Pipeline](https://github.com/CaryuterSal/OmniMarket/actions/workflows/ci.yml/badge.svg)](https://github.com/CaryuterSal/OmniMarket/actions/workflows/ci.yml)

Dashboard de Analítica E-Commerce y Control de Operaciones en Tiempo Real construido con **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM (PostgreSQL)**, **NextAuth.js (OAuth 2.0 Exclusivo con Google & GitHub)**, **Zod**, **Sonner**, **Vitest** y **Playwright**.

**URL en Producción (Vercel):** [https://omni-market-sand.vercel.app](https://omni-market-sand.vercel.app)

---

## Características Principales y Cumplimiento Técnico

- **SLA de Baja Latencia (`< 300ms` garantizado):**
  - Agregación nativa en SQL mediante `prisma.order.groupBy()` en un único viaje de red paralelo junto con un sistema de caché en memoria (`src/lib/analytics-cache.ts`) con invalidación reactiva en mutaciones (`POST`, `PATCH`, `DELETE`, `reset-data`).
  - Índices simples y compuestos (`@@index([status])`, `@@index([createdAt])`, `@@index([status, createdAt])`) sobre **PostgreSQL**.
- **Autenticación OAuth 2.0 Exclusiva:**
  - Soporte exclusivo para **Google Auth** y **GitHub Auth** mediante `NextAuth.js` (`src/lib/auth.ts` y `src/app/login/page.tsx`).
  - Protección de rutas privadas `/dashboard/*` mediante `src/middleware.ts`.
- **Estados de Carga con Skeletons:**
  - Componentes dedicados con `animate-pulse` de Tailwind CSS (`src/components/Skeletons.tsx` y `src/app/dashboard/loading.tsx`), sin uso de spinners genéricos.
- **Tablero Kanban con Drag & Drop Optimista:**
  - Actualización inmediata del DOM en `0ms`, notificación Toast con `sonner`, persistencia asíncrona en PostgreSQL y rollback automático en caso de error de red.
- **Gestión CRUD + Catálogo + Bulk Update:**
  - Registro de nuevos pedidos y productos validados con esquemas `Zod`, reflejo inmediato en las tablas (`orders-table` y `products-table`), búsqueda/filtrado en tiempo real y actualización masiva al seleccionar 2 o más pedidos.
- **Pipeline CI/CD en GitHub Actions con Bloqueo de Despliegue en Vercel:**
  - El workflow `.github/workflows/ci.yml` levanta un servicio real de PostgreSQL 15, ejecuta las **10 pruebas unitarias (Vitest)**, compila el build de producción y ejecuta los **3 flujos End-to-End (Playwright)** antes de autorizar el despliegue a producción en Vercel (`npx vercel --prod`).

---

## Endpoints de Auditoría API (`/api/test/*`)

### 1. Métricas de Ventas y Paginación (`GET /api/test/analytics`)
Retorna órdenes paginadas, metadatos con tiempo de respuesta (`latencyMs < 300ms`), header `X-Response-Time` y métricas financieras agregadas (`totalRevenue`, `averageTicket`, `profitMargin`, `ordersByStatus`).

```bash
curl -i "https://omni-market-sand.vercel.app/api/test/analytics?page=1&limit=50"
```

### 2. Verificación de Persistencia Kanban (`GET /api/test/kanban-status`)
Permite auditar el estado actual en PostgreSQL de cualquier tarjeta del tablero Kanban tras una operación de Drag & Drop.

```bash
curl -s "https://omni-market-sand.vercel.app/api/test/kanban-status?orderId=order-1"
```

### 3. Restauración Determinista para Pruebas E2E (`POST /api/test/reset-data`)
Restaura la base de datos a un estado determinista (50 pedidos con `#order-1`, `#order-2`, `#order-3` en `PENDING` y 10 productos de catálogo) e hidrata la caché de analítica.

```bash
curl -X POST "https://omni-market-sand.vercel.app/api/test/reset-data"
```

---

## Variables de Entorno (`.env`)

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/omnimarket?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/omnimarket?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-nextauth-secret"
GOOGLE_CLIENT_ID="tu-google-client-id"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"
GITHUB_ID="tu-github-client-id"
GITHUB_SECRET="tu-github-client-secret"
```

---

## Comandos de Desarrollo y Verificación

```bash
# 1. Instalar dependencias
npm install

# 2. Sincronizar esquema Prisma (PostgreSQL) y poblar datos iniciales (60 pedidos, 15 productos)
npx prisma db push
npm run db:seed

# 3. Ejecutar las 10 pruebas unitarias con Vitest
npm run test:unit

# 4. Compilar para producción
npm run build

# 5. Ejecutar los 3 flujos E2E con Playwright (incluye creación de pedido y producto)
npm run test:e2e
```
