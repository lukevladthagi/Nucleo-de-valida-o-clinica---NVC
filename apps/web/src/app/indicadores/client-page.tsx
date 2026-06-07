"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Indicadores = nextDynamic(() => import("@/views/Indicadores"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Indicadores /></SidebarProvider></AuthProvider>;
}
