import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniMarket — Gestión de Pedidos e Inventario",
  description:
    "Plataforma de administración de ventas, envíos e inventario para comercio electrónico.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased selection:bg-indigo-600 selection:text-white">
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </body>
    </html>
  );
}
