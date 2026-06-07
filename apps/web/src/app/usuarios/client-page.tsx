"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Usuarios = nextDynamic(() => import("@/views/Usuarios"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Usuarios /></SidebarProvider></AuthProvider>;
}
