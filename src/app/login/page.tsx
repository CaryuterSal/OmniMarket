"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { Sparkles, ShieldCheck, Github, Chrome, ArrowRight } from "lucide-react";

export default function LoginPage() {
  function handleQuickDemoAccess() {
    document.cookie = "x-e2e-test-auth=true; path=/; max-age=86400";
    window.location.href = "/dashboard";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/40 bg-indigo-600/20 text-indigo-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            OmniMarket Operations Hub
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Inicia sesión con tu cuenta corporativa OAuth 2.0 para acceder al
            panel de analítica y operaciones en tiempo real.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            data-testid="oauth-google-btn"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            <Chrome className="h-4 w-4 text-indigo-600" />
            Continuar con Google
          </button>

          <button
            type="button"
            data-testid="oauth-github-btn"
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            <Github className="h-4 w-4" />
            Continuar con GitHub
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Entorno de Evaluación / E2E
          </span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          data-testid="demo-bypass-login-btn"
          onClick={handleQuickDemoAccess}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/15 px-4 py-2.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-600/25"
        >
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          Acceso Directo Operador (Sandbox / Hackathon Demo)
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
