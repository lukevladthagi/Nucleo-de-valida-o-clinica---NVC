"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Internacoes = nextDynamic(() => import("@/views/Internacoes"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Internacoes /></SidebarProvider></AuthProvider>;
}
