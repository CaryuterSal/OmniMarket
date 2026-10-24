import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniMarket - Operations Hub | Real-Time E-Commerce Analytics",
  description:
    "Dashboard de Analítica E-Commerce en Tiempo Real con Kanban Drag & Drop Optimista y Gestión de Pedidos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
