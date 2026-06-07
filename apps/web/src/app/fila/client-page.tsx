"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const ValidatorQueue = nextDynamic(() => import("@/views/ValidatorQueue"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><ValidatorQueue /></SidebarProvider></AuthProvider>;
}
