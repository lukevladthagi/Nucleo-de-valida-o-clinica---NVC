"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Prioridades = nextDynamic(() => import("@/views/Prioridades"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Prioridades /></SidebarProvider></AuthProvider>;
}
