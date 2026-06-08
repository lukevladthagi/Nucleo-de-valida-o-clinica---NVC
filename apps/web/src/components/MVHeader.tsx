"use client";

import { useAuth } from "@/lib/auth-shim";
import { useUserProfile } from "@/hooks/useUserProfile";
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
  const { profile } = useUserProfile();

  const displayName = profile?.name || user?.name || user?.email?.split("@")[0] || "Usuario";
  const displayEmail = profile?.email || user?.email || "";
  const avatarImage = user?.image || user?.google_user_data?.picture || undefined;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  const handleLogout = async () => {
    await logout();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[#5A7B9A] text-white shadow-md z-50 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <img
          src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png"
          alt="Nucleo de Validacao Clinica"
          className="h-8 object-contain"
        />
        <div className="h-6 w-px bg-white/30" />
        <div className="text-sm font-medium">HOSPITAL PRONTOCARDIO</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-white/80 hidden md:block">
          {new Date().toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        <div className="h-6 w-px bg-white/30 hidden md:block" />

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 h-9 w-9 p-0"
        >
          <Bell className="h-4 w-4" />
        </Button>

        <Link to="/configuracoes">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 h-9 w-9 p-0"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </Link>

        <div className="h-6 w-px bg-white/30" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2 text-white hover:bg-white/10">
              <Avatar className="h-7 w-7 mr-2">
                <AvatarImage src={avatarImage} alt={displayName} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">
                {displayName.split(" ")[0] || "Usuario"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
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
