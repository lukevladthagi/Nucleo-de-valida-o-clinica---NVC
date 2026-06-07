'use client';

import { Link, useLocation } from '@/lib/router-shim';
import {
  LayoutDashboard,
  ListChecks,
  Bed,
  Users,
  UserCircle,
  CreditCard,
  Stethoscope,
  Clock,
  Filter,
  AlertCircle,
  Bell,
  BarChart3,
  FileText,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { useUserProfile, UserRole } from '@/hooks/useUserProfile';

interface MenuItem {
  path: string;
  icon: any;
  label: string;
  badge?: number;
  allowedRoles?: UserRole[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function MVSidebar() {
  const location = useLocation();
  const { profile, loading } = useUserProfile();

  const isActive = (path: string) => location.pathname === path;

  const hasAccess = (allowedRoles?: UserRole[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    // Show all items while profile is loading to avoid empty sidebar
    if (loading || !profile) return true;
    return allowedRoles.includes(profile.role);
  };

  const menuSections: MenuSection[] = [
    {
      title: 'GERAL',
      items: [
        {
          path: '/dashboard',
          icon: LayoutDashboard,
          label: 'Dashboard',
          allowedRoles: ['admin', 'validator', 'nurse'],
        },
        {
          path: '/fila',
          icon: ListChecks,
          label: 'Fila de Validação',
          allowedRoles: ['admin', 'validator'],
        },
        { path: '/solicitacoes', icon: FileText, label: 'Solicitações', allowedRoles: ['admin'] },
        { path: '/internacoes', icon: Bed, label: 'Internações', allowedRoles: ['admin'] },
      ],
    },
    {
      title: 'CADASTROS',
      items: [
        { path: '/usuarios', icon: Users, label: 'Usuários', allowedRoles: ['admin'] },
        {
          path: '/validadores',
          icon: Stethoscope,
          label: 'Equipe de Regulação',
          allowedRoles: ['admin'],
        },
        { path: '/convenios', icon: CreditCard, label: 'Convênios', allowedRoles: ['admin'] },
        { path: '/medicos', icon: UserCircle, label: 'Médicos', allowedRoles: ['admin'] },
      ],
    },
    {
      title: 'CONFIGURAÇÕES',
      items: [
        { path: '/config-sla', icon: Clock, label: 'SLA', allowedRoles: ['admin'] },
        { path: '/config-criterios', icon: Filter, label: 'Critérios', allowedRoles: ['admin'] },
        {
          path: '/config-prioridades',
          icon: AlertCircle,
          label: 'Prioridades',
          allowedRoles: ['admin'],
        },
        { path: '/notificacoes', icon: Bell, label: 'Notificações', allowedRoles: ['admin'] },
      ],
    },
    {
      title: 'RELATÓRIOS',
      items: [
        { path: '/indicadores', icon: BarChart3, label: 'Indicadores', allowedRoles: ['admin'] },
        { path: '/auditoria', icon: FileText, label: 'Auditoria', allowedRoles: ['admin'] },
        { path: '/diagnostico', icon: Activity, label: 'Diagnóstico', allowedRoles: ['admin'] },
      ],
    },
  ];

  return (
    <div className="fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-56 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="py-4">
        {menuSections.map((section, idx) => {
          const visibleItems = section.items.filter((item) => hasAccess(item.allowedRoles));

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="mb-6">
              {/* Section Title */}
              <div className="px-4 mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>

              {/* Menu Items */}
              <nav className="space-y-1 px-2">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Link key={item.path} to={item.path}>
                      <div
                        className={`
                          flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors
                          ${
                            active
                              ? 'bg-[#5A7B9A] text-white font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                        {active && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
    </div>
  );
}
