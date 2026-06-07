"use client";

import { Link, useLocation } from "@/lib/router-shim";
import { useAuth } from "@/lib/auth-shim";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ListChecks, UserCircle, ChevronLeft, ChevronRight, Activity, FileText, Hospital, Users, Stethoscope, Clock, Target, Bell, BarChart3, FileSearch, Wrench } from "lucide-react";
import { useSidebar } from "@/hooks/useSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"}`}>
      {/* Logo/Brand */}
      <div className={`border-b border-gray-200 ${isCollapsed ? "p-3" : "p-6"}`}>
        <Link to="/fila" className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-3"}`}>
          <img 
            src="https://019e0360-cd34-74d4-8292-bf757f2d4639.mochausercontent.com/ndir-icon.png" 
            alt="NDIR"
            className="h-10 w-10 flex-shrink-0"
          />
          {!isCollapsed && (
            <div>
              <div className="font-bold text-lg text-gray-900">NDIR</div>
              <div className="text-xs text-gray-500">Prontocardio</div>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* GERAL */}
        {!isCollapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Geral</span>
          </div>
        )}
        <div className="space-y-1 mb-6">
          <Link to="/dashboard">
            <Button
              variant={isActive("/dashboard") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Dashboard" : undefined}
            >
              <LayoutDashboard className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Dashboard</span>}
            </Button>
          </Link>
          
          <Link to="/fila">
            <Button
              variant={isActive("/fila") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Fila de Validação" : undefined}
            >
              <ListChecks className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Fila de Validação</span>}
            </Button>
          </Link>
          
          <Link to="/solicitacoes">
            <Button
              variant={isActive("/solicitacoes") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Solicitações" : undefined}
            >
              <FileText className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Solicitações</span>}
            </Button>
          </Link>
          
          <Link to="/internacoes">
            <Button
              variant={isActive("/internacoes") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Internações" : undefined}
            >
              <Hospital className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Internações</span>}
            </Button>
          </Link>
        </div>

        {/* CADASTROS */}
        {!isCollapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cadastros</span>
          </div>
        )}
        <div className="space-y-1 mb-6">
          <Link to="/usuarios">
            <Button
              variant={isActive("/usuarios") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Usuários" : undefined}
            >
              <Users className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Usuários</span>}
            </Button>
          </Link>
          
          <Link to="/validadores">
            <Button
              variant={isActive("/validadores") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Equipe de Regulação" : undefined}
            >
              <UserCircle className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Equipe de Regulação</span>}
            </Button>
          </Link>
          
          <Link to="/convenios">
            <Button
              variant={isActive("/convenios") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Convênios" : undefined}
            >
              <FileText className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Convênios</span>}
            </Button>
          </Link>
          
          <Link to="/medicos">
            <Button
              variant={isActive("/medicos") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Médicos" : undefined}
            >
              <Stethoscope className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Médicos</span>}
            </Button>
          </Link>
        </div>

        {/* CONFIGURAÇÕES */}
        {!isCollapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Configurações</span>
          </div>
        )}
        <div className="space-y-1 mb-6">
          <Link to="/sla">
            <Button
              variant={isActive("/sla") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "SLA" : undefined}
            >
              <Clock className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">SLA</span>}
            </Button>
          </Link>
          
          <Link to="/criterios">
            <Button
              variant={isActive("/criterios") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Critérios" : undefined}
            >
              <Target className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Critérios</span>}
            </Button>
          </Link>
          
          <Link to="/prioridades">
            <Button
              variant={isActive("/prioridades") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Prioridades" : undefined}
            >
              <Activity className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Prioridades</span>}
            </Button>
          </Link>
          
          <Link to="/notificacoes">
            <Button
              variant={isActive("/notificacoes") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Notificações" : undefined}
            >
              <Bell className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Notificações</span>}
            </Button>
          </Link>
          
          <Link to="/configuracoes">
            <Button
              variant={isActive("/configuracoes") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Integrações" : undefined}
            >
              <Wrench className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Integrações</span>}
            </Button>
          </Link>
        </div>

        {/* RELATÓRIOS */}
        {!isCollapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Relatórios</span>
          </div>
        )}
        <div className="space-y-1">
          <Link to="/indicadores">
            <Button
              variant={isActive("/indicadores") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Indicadores" : undefined}
            >
              <BarChart3 className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Indicadores</span>}
            </Button>
          </Link>
          
          <Link to="/auditoria">
            <Button
              variant={isActive("/auditoria") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Auditoria" : undefined}
            >
              <FileSearch className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Auditoria</span>}
            </Button>
          </Link>
          
          <Link to="/diagnostico-telegram">
            <Button
              variant={isActive("/diagnostico-telegram") ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start"} h-9`}
              title={isCollapsed ? "Diagnóstico" : undefined}
            >
              <Activity className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span className="text-sm">Diagnóstico</span>}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Toggle Button */}
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={`w-full ${isCollapsed ? "justify-center px-0" : "justify-start"}`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
          {!isCollapsed && <span className="text-xs">Recolher</span>}
        </Button>
      </div>

      {/* User Profile at Bottom */}
      <div className="p-4 border-t border-gray-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`w-full p-2 h-auto ${isCollapsed ? "justify-center" : "justify-start"}`}>
              <Avatar className={`h-9 w-9 ${!isCollapsed && "mr-3"}`}>
                <AvatarImage src={user?.google_user_data?.picture || undefined} alt={user?.email} />
                <AvatarFallback>
                  {user?.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-col items-start overflow-hidden flex-1">
                  <p className="text-sm font-medium leading-none truncate w-full">
                    {user?.google_user_data?.name || "Usuário"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate w-full">
                    {user?.email}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" side="top">
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
