"use client";

import { useState, useEffect } from "react";
import { Link } from "@/lib/router-shim";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  User, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Send
} from "lucide-react";

interface Request {
  id: number;
  protocol: string;
  medical_record_number: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  insurance: string;
  requesting_physician: string;
  mvsoul_number: string;
  origin: string;
  priority_classification: string;
  clinical_risk: string;
  status: string;
  created_at: string;
  sla_minutes: number;
  assigned_validator_id: number | null;
}

interface SLAStatus {
  remaining: string;
  expired: boolean;
  percentage: number;
}

export default function ValidatorQueue() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setError(null);
      const response = await fetch("/api/requests");
      if (!response.ok) {
        throw new Error("Erro ao buscar solicitações");
      }
      const data = await response.json();
      setRequests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const calculateSLA = (createdAt: string, slaMinutes: number): SLAStatus => {
    const created = new Date(createdAt);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
    const remaining = slaMinutes - elapsed;
    const percentage = Math.min(100, (elapsed / slaMinutes) * 100);

    if (remaining <= 0) {
      return {
        remaining: "VENCIDO",
        expired: true,
        percentage: 100,
      };
    }

    return {
      remaining: `${remaining}min`,
      expired: false,
      percentage,
    };
  };

  const getPriorityBadge = (priority: string) => {
    const priorityLower = priority?.toLowerCase();
    switch (priorityLower) {
      case "imediata":
        return <Badge className="bg-red-600 text-white hover:bg-red-700">🔴 Imediata</Badge>;
      case "urgente":
        return <Badge className="bg-yellow-600 text-white hover:bg-yellow-700">🟠 Urgente</Badge>;
      case "eletiva":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">🔵 Eletiva</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    const riskLower = risk?.toLowerCase();
    switch (riskLower) {
      case "alto":
        return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">Alto Risco</Badge>;
      case "moderado":
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">Moderado</Badge>;
      case "baixo":
        return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">Baixo</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  const handleResendNotification = async (protocol: string) => {
    try {
      const response = await fetch(`/api/requests/${protocol}/resend-notification`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erro ao reenviar notificação");
      }

      alert(`Notificação reenviada para o protocolo ${protocol}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao reenviar notificação");
    }
  };

  const pendingRequests = requests.filter((r) => {
    const status = r.status?.toLowerCase().trim();
    return status === 'aguardando validação' || status.includes('aguardando');
  });
  
  const immediateRequests = pendingRequests.filter((r) => 
    r.priority_classification?.toLowerCase().trim() === "imediata"
  );
  const urgentRequests = pendingRequests.filter((r) => 
    r.priority_classification?.toLowerCase().trim() === "urgente"
  );
  const electiveRequests = pendingRequests.filter((r) => 
    r.priority_classification?.toLowerCase().trim() === "eletiva"
  );

  const sortedRequests = [
    ...immediateRequests.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    ...urgentRequests.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    ...electiveRequests.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  ];

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5A7B9A] mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando fila de validação...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="p-6">
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-900">Erro ao carregar fila</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Fila de Validação</h1>
            <p className="text-sm text-gray-600">Central Operacional — Regulação de Internações</p>
          </div>
          <Button
            onClick={fetchRequests}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Total na Fila</div>
                  <div className="text-2xl font-bold text-gray-900">{pendingRequests.length}</div>
                </div>
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-red-700 mb-1 font-medium">🔴 Imediatas</div>
                  <div className="text-2xl font-bold text-red-700">{immediateRequests.length}</div>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-yellow-200 bg-yellow-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-yellow-700 mb-1 font-medium">🟠 Urgentes</div>
                  <div className="text-2xl font-bold text-yellow-700">{urgentRequests.length}</div>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-700 mb-1 font-medium">🔵 Eletivas</div>
                  <div className="text-2xl font-bold text-blue-700">{electiveRequests.length}</div>
                </div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue Table - MVSoul Style */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">
              Pacientes Aguardando Validação ({sortedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sortedRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Nenhuma solicitação pendente</p>
                <p className="text-sm">Todas as solicitações foram processadas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Protocolo</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Paciente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Atendimento</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Convênio</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Prioridade</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Risco</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">SLA</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Médico</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedRequests.map((request) => {
                      const slaStatus = calculateSLA(request.created_at, request.sla_minutes);
                      
                      return (
                        <tr 
                          key={request.id} 
                          className={`
                            hover:bg-gray-50 transition-colors
                            ${slaStatus.expired ? "bg-red-50" : ""}
                          `}
                        >
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs text-gray-700">{request.protocol}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(request.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-gray-600 mb-0.5">Prontuário: {request.medical_record_number || 'N/A'}</div>
                            <div className="font-medium text-gray-900">{request.patient_name}</div>
                            <div className="text-xs text-gray-500">
                              {request.patient_age} anos • {request.patient_gender}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{request.mvsoul_number}</td>
                          <td className="py-3 px-4 text-gray-700">{request.insurance}</td>
                          <td className="py-3 px-4">{getPriorityBadge(request.priority_classification)}</td>
                          <td className="py-3 px-4">{getRiskBadge(request.clinical_risk)}</td>
                          <td className="py-3 px-4">
                            <div className={`
                              text-sm font-semibold
                              ${slaStatus.expired ? "text-red-700" : "text-gray-700"}
                            `}>
                              {slaStatus.remaining}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className={`h-1.5 rounded-full transition-all ${
                                  slaStatus.expired 
                                    ? "bg-red-600" 
                                    : slaStatus.percentage > 70 
                                    ? "bg-yellow-500" 
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${slaStatus.percentage}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-xs">{request.requesting_physician}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Link to={`/validacao/${request.protocol}`}>
                                <Button size="sm" className="bg-[#5A7B9A] hover:bg-[#4a6b8a] text-white">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Avaliar
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResendNotification(request.protocol)}
                                title="Reenviar notificação"
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
