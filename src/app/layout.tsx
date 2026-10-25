import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniMarket — Operations Hub",
  description:
    "Plataforma de administración de ventas, envíos e inventario para comercio electrónico.",
  icons: {
    icon: "/logo-icon.jpg",
    shortcut: "/logo-icon.jpg",
    apple: "/logo-icon.jpg",
  },
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
        <Toaster
          richColors
          position="bottom-right"
          closeButton
          expand
          visibleToasts={5}
        />
      </body>
    </html>
  );
}
