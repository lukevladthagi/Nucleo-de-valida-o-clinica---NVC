"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Notificacoes = nextDynamic(() => import("@/views/Notificacoes"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Notificacoes /></SidebarProvider></AuthProvider>;
}
