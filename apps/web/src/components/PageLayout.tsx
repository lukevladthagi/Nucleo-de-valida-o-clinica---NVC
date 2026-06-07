"use client";

import { ReactNode } from "react";
import MVHeader from "@/components/MVHeader";
import MVSidebar from "@/components/MVSidebar";

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      <MVHeader />
      <div className="flex flex-1 pt-14">
        <MVSidebar />
        <main className="flex-1 ml-56 overflow-auto bg-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
}
