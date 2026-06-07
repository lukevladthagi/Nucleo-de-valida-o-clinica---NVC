"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const TelegramDiagnostic = nextDynamic(() => import("@/views/TelegramDiagnostic"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><TelegramDiagnostic /></SidebarProvider></AuthProvider>;
}
