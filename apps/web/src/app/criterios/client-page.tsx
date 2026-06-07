"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Criterios = nextDynamic(() => import("@/views/Criterios"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Criterios /></SidebarProvider></AuthProvider>;
}
