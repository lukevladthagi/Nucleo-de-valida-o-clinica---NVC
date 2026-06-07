"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const SecureFormAccess = nextDynamic(() => import("@/components/SecureFormAccess"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><SecureFormAccess /></SidebarProvider></AuthProvider>;
}
