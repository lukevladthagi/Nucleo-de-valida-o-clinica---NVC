"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Dashboard = nextDynamic(() => import("@/views/Dashboard"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Dashboard /></SidebarProvider></AuthProvider>;
}
