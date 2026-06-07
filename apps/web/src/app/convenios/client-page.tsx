"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Convenios = nextDynamic(() => import("@/views/Convenios"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Convenios /></SidebarProvider></AuthProvider>;
}
