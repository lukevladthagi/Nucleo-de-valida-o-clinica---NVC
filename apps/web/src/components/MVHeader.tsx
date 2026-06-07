"use client";

import { useAuth } from "@/lib/auth-shim";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, Settings as SettingsIcon } from "lucide-react";
import { Link } from "@/lib/router-shim";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MVHeader() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[#5A7B9A] text-white shadow-md z-50 flex items-center justify-between px-4">
      {/* Left: Logo and Hospital */}
      <div className="flex items-center gap-4">
        <img 
          src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png" 
          alt="Núcleo de Validação Clínica"
          className="h-8 object-contain"
        />
        <div className="h-6 w-px bg-white/30"></div>
        <div className="text-sm font-medium">
          HOSPITAL PRONTOCARDIO
        </div>
      </div>

      {/* Right: Notifications and User */}
      <div className="flex items-center gap-3">
        {/* Session Time */}
        <div className="text-xs text-white/80 hidden md:block">
          {new Date().toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        <div className="h-6 w-px bg-white/30 hidden md:block"></div>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 h-9 w-9 p-0"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Settings */}
        <Link to="/configuracoes">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 h-9 w-9 p-0"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </Link>

        <div className="h-6 w-px bg-white/30"></div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2 text-white hover:bg-white/10">
              <Avatar className="h-7 w-7 mr-2">
                <AvatarImage src={user?.google_user_data?.picture || undefined} alt={user?.email} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {user?.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">
                {user?.google_user_data?.name?.split(" ")[0] || "Usuário"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.google_user_data?.name || "Usuário"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
