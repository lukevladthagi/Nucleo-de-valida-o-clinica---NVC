"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Auditoria = nextDynamic(() => import("@/views/Auditoria"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Auditoria /></SidebarProvider></AuthProvider>;
}
