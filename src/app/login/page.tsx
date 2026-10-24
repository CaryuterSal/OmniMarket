"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { Github, Chrome, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-slate-900">
      <div className="w-full max-w-[420px] rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0d182a] px-6 py-4 shadow-md">
            <img
              src="/logo-full.jpg"
              alt="OmniMarket Logo"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bienvenido a OmniMarket
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Inicia sesión con OAuth 2.0 para gestionar tus ventas, envíos e inventario.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            data-testid="oauth-google-btn"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
          >
            <Chrome className="h-4 w-4 text-indigo-600" />
            Continuar con Google
          </button>

          <button
            type="button"
            data-testid="oauth-github-btn"
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:bg-slate-950"
          >
            <Github className="h-4 w-4" />
            Continuar con GitHub
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600" />
          <span>Autenticación exclusiva OAuth 2.0 protegida con NextAuth.js</span>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        OmniMarket © {new Date().getFullYear()} • Centro de Operaciones
      </p>
    </div>
  );
}
