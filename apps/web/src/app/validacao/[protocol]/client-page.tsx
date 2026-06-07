"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const ValidatorPage = nextDynamic(() => import("@/views/ValidatorPage"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><ValidatorPage /></SidebarProvider></AuthProvider>;
}
