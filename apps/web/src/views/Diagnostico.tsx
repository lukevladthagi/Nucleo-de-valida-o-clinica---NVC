"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationLog {
  id: number;
  created_at: string;
  request_protocol: string;
  validator_id: number | null;
  validator_name: string | null;
  channel: string;
  recipient: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  telegram_message_id: string | null;
}

export default function Diagnostico() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/notification-logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.results || []);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Enviado
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelBadge = (channel: string) => {
    const colors = {
      telegram: "bg-blue-100 text-blue-800 border-blue-300",
      email: "bg-purple-100 text-purple-800 border-purple-300",
      whatsapp: "bg-green-100 text-green-800 border-green-300",
    };
    return (
      <Badge className={colors[channel as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-300"}>
        {channel}
      </Badge>
    );
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando logs...</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Diagnóstico</h1>
            <p className="text-gray-600 mt-1">
              Histórico de notificações do sistema
            </p>
          </div>
          <Button 
            onClick={fetchLogs} 
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registro de Notificações</CardTitle>
            <CardDescription>
              Total de {logs.length} notificações registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma notificação registrada ainda.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            Protocolo: {log.request_protocol}
                          </span>
                          {getStatusBadge(log.status)}
                          {getChannelBadge(log.channel)}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Destinatário:</span> {log.recipient}
                          </p>
                          {log.validator_name && (
                            <p>
                              <span className="font-medium">Validador:</span> {log.validator_name}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Data de criação:</span> {formatDate(log.created_at)}
                          </p>
                          {log.sent_at && (
                            <p>
                              <span className="font-medium">Data de envio:</span> {formatDate(log.sent_at)}
                            </p>
                          )}
                          {log.telegram_message_id && (
                            <p>
                              <span className="font-medium">ID da mensagem Telegram:</span> {log.telegram_message_id}
                            </p>
                          )}
                        </div>

                        {log.error_message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            <span className="font-medium">Erro:</span> {log.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
