"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Medicos = nextDynamic(() => import("@/views/Medicos"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Medicos /></SidebarProvider></AuthProvider>;
}
