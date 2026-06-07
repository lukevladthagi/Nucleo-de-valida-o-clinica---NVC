"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Settings = nextDynamic(() => import("@/views/Settings"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Settings /></SidebarProvider></AuthProvider>;
}
