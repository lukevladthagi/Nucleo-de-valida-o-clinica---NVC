"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Login = nextDynamic(() => import("@/views/Login"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Login /></SidebarProvider></AuthProvider>;
}
