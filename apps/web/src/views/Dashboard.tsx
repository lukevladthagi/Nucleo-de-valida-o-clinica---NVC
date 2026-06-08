"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageLayout from "@/components/PageLayout";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Activity,
  FileText,
  Send
} from "lucide-react";

interface DashboardStats {
  today_total: number;
  pending: number;
  approved: number;
  denied: number;
  sla_expired: number;
  avg_response_time: string;
  fast_track: number;
}

interface Request {
  id: number;
  protocol: string;
  patient_name: string;
  mvsoul_number: string;
  insurance: string;
  priority_classification: string;
  clinical_risk: string;
  status: string;
  requesting_physician: string;
  created_at: string;
  validator_physician?: string;
  decision?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingProtocol, setResendingProtocol] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, requestsRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/dashboard/recent")
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRecentRequests(requestsData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendNotifications = async (protocol: string) => {
    setResendingProtocol(protocol);
    try {
      const response = await fetch(`/api/requests/${protocol}/resend-notifications`, {
        method: "POST",
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Notificações reenviadas com sucesso para ${result.notificationsSent} validador(es)`);
      } else {
        alert(`Erro ao reenviar notificações: ${result.error}`);
      }
    } catch (error) {
      console.error("Error resending notifications:", error);
      alert("Erro ao reenviar notificações");
    } finally {
      setResendingProtocol(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const priorityLower = priority?.toLowerCase();
    const variants: Record<string, { className: string; label: string }> = {
      imediata: { className: "bg-red-600 text-white", label: "🔴 Imediata" },
      urgente: { className: "bg-yellow-600 text-white", label: "🟠 Urgente" },
      eletiva: { className: "bg-blue-600 text-white", label: "🔵 Eletiva" },
    };
    const variant = variants[priorityLower] || { className: "bg-gray-600 text-white", label: priority };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase().replace(/\s+/g, '_');
    const variants: Record<string, { className: string; label: string }> = {
      aguardando_validacao: { className: "bg-blue-500 text-white", label: "Aguardando" },
      aguardando_validação: { className: "bg-blue-500 text-white", label: "Aguardando" },
      aprovada: { className: "bg-green-600 text-white", label: "Aprovada" },
      negada: { className: "bg-red-600 text-white", label: "Negada" },
      complemento_solicitado: { className: "bg-yellow-600 text-white", label: "Complemento" },
    };
    const variant = variants[statusLower] || { className: "bg-slate-500 text-white", label: status };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5A7B9A] mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard Operacional</h1>
          <p className="text-sm text-gray-600">Central de Regulação e Internação — Prontocardio</p>
        </div>

        {/* Stats Grid - MVSoul Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Solicitações */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Solicitações Hoje</div>
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats?.today_total || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Total registrado</div>
            </CardContent>
          </Card>

          {/* Pendentes */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Aguardando Validação</div>
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{stats?.pending || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Em fila</div>
            </CardContent>
          </Card>

          {/* Aprovadas */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Aprovadas</div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-600">{stats?.approved || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Internações liberadas</div>
            </CardContent>
          </Card>

          {/* Negadas */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Negadas</div>
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-600">{stats?.denied || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Não autorizadas</div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* SLA Vencido */}
          <Card className="border border-yellow-200 bg-yellow-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-yellow-800">SLA Vencido</div>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-3xl font-bold text-yellow-700">{stats?.sla_expired || 0}</div>
              <div className="text-xs text-yellow-600 mt-1">Requer atenção imediata</div>
            </CardContent>
          </Card>

          {/* Tempo Médio */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Tempo Médio</div>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats?.avg_response_time || "--:--"}</div>
              <div className="text-xs text-gray-500 mt-1">Resposta validação</div>
            </CardContent>
          </Card>

          {/* Fast-Track */}
          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-red-800">Fast-Track</div>
                <Activity className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-3xl font-bold text-red-700">{stats?.fast_track || 0}</div>
              <div className="text-xs text-red-600 mt-1">Prioridade imediata</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests Table - MVSoul Style */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">Solicitações Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Protocolo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Paciente</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Atendimento</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Convênio</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Prioridade</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Médico</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Validado por</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Data/Hora</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-gray-500">
                        Nenhuma solicitação registrada
                      </td>
                    </tr>
                  ) : (
                    recentRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-gray-700">{request.protocol}</td>
                        <td className="py-3 px-4 text-gray-900 font-medium">{request.patient_name}</td>
                        <td className="py-3 px-4 text-gray-700">{request.mvsoul_number}</td>
                        <td className="py-3 px-4 text-gray-700">{request.insurance}</td>
                        <td className="py-3 px-4">{getPriorityBadge(request.priority_classification)}</td>
                        <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                        <td className="py-3 px-4 text-gray-700">{request.requesting_physician}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {request.validator_physician ? (
                            <div className="font-medium text-gray-900">{request.validator_physician}</div>
                          ) : (
                            <span className="text-xs text-gray-400">Aguardando validação</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {new Date(request.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleResendNotifications(request.protocol)}
                            disabled={resendingProtocol === request.protocol}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title="Reenviar notificação do Telegram"
                          >
                            <Send className="h-3 w-3" />
                            {resendingProtocol === request.protocol ? "Enviando..." : "Reenviar"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
