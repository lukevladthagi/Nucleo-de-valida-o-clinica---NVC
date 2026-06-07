"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Solicitacoes = nextDynamic(() => import("@/views/Solicitacoes"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Solicitacoes /></SidebarProvider></AuthProvider>;
}
