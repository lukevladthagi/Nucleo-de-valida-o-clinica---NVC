"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const SLA = nextDynamic(() => import("@/views/SLA"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><SLA /></SidebarProvider></AuthProvider>;
}
