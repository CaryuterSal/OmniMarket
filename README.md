# OmniMarket — Operations Hub

Dashboard de Analítica E-Commerce y Control de Operaciones en Tiempo Real construido con **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM (SQLite)**, **NextAuth.js (Google & GitHub OAuth 2.0)**, **Zod**, **Sonner**, **Vitest** y **Playwright**.

## Características Principales

- **SLA de Baja Latencia (< 300ms):** Índices compuestos e individuales en `Order.status` y `Order.createdAt` sobre Prisma + SQLite (`file:./dev.db`).
- **Autenticación OAuth 2.0 + Bypass E2E:** Proveedores Google y GitHub en `/login`, protección de rutas en `src/middleware.ts` y soporte de cookie `x-e2e-test-auth` para ejecución determinista en CI/CD.
- **Estados de Carga con Skeletons:** Componentes exclusivos con `animate-pulse` de Tailwind CSS (`src/components/Skeletons.tsx` y `src/app/dashboard/loading.tsx`).
- **Tablero Kanban con Drag & Drop Optimista:** Actualización de UI en `0ms`, notificación Toast con `sonner` y reversión automática ante errores de red.
- **Tabla CRUD + Creación + Bulk Update:** Validación con esquemas `Zod`, búsqueda y filtrado en tiempo real y barra de edición masiva al seleccionar 2 o más pedidos.

## Comandos Principales

```bash
# Sincronizar esquema Prisma y poblar datos iniciales (60 pedidos, 15 productos)
npx prisma db push
npm run db:seed

# Ejecutar las 10 pruebas unitarias con Vitest
npm run test:unit

# Compilar para producción
npm run build

# Ejecutar las 3 pruebas E2E con Playwright
npm run test:e2e
```
