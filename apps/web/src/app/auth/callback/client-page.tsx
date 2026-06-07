"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const AuthCallback = nextDynamic(() => import("@/views/AuthCallback"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><AuthCallback /></SidebarProvider></AuthProvider>;
}
