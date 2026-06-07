"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { SidebarProvider } from "@/hooks/useSidebar";

const Validators = nextDynamic(() => import("@/views/Validators"), {
  ssr: false,
});

export default function ClientPage() {
  return <AuthProvider><SidebarProvider><Validators /></SidebarProvider></AuthProvider>;
}
