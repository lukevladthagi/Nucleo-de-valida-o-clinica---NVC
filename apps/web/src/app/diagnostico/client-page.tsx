"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Diagnostico = nextDynamic(() => import("@/views/Diagnostico"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Diagnostico /></SidebarProvider></AuthProvider>;
}
