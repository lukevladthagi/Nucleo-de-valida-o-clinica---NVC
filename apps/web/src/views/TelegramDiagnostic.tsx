"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Send,
  Database
} from "lucide-react";

interface DiagnosticData {
  telegramToken: {
    configured: boolean;
    masked: string;
  };
  webhookInfo: {
    configured: boolean;
    url: string;
    pendingUpdates: number;
  };
  validators: Array<{
    id: number;
    name: string;
    telegram_chat_id: string | null;
    notification_telegram: boolean;
  }>;
  recentRequests: Array<{
    protocol: string;
    patient_name: string;
    created_at: string;
    assigned_validator_id: number | null;
    status: string;
  }>;
}

export default function TelegramDiagnostic() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testDiagnostic, setTestDiagnostic] = useState<any>(null);

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  const fetchDiagnostic = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/telegram/diagnostic");
      if (!response.ok) throw new Error("Erro ao carregar diagnóstico");
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setTestDiagnostic(null);
      
      const response = await fetch("/api/telegram/test", {
        method: "POST",
      });
      
      const result = await response.json();
      
      // Store diagnostic log
      if (result.diagnostic) {
        setTestDiagnostic(result.diagnostic);
      }
      
      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar mensagem de teste");
      }
      
      setTestResult(`✅ Mensagem de teste enviada para ${result.sentTo} de ${result.total} validador(es)`);
    } catch (err: any) {
      setTestResult(`❌ Erro: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6">Diagnóstico do Telegram</h1>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6">Diagnóstico do Telegram</h1>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error || "Erro ao carregar dados"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Diagnóstico do Telegram</h1>
        <div className="space-y-6">
        {/* Status do Token */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {data.telegramToken.configured ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Token do Bot
            </CardTitle>
            <CardDescription>
              Configuração do token de acesso ao Telegram Bot API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.telegramToken.configured ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  ✓ Token configurado
                </p>
                <p className="text-sm font-mono text-muted-foreground">
                  {data.telegramToken.masked}
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-700">
                ✗ Token não configurado. Configure em Configurações → Notificações
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status do Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {data.webhookInfo.configured ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Webhook do Telegram
            </CardTitle>
            <CardDescription>
              Configuração do webhook para receber atualizações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.webhookInfo.configured ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  ✓ Webhook configurado
                </p>
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {data.webhookInfo.url}
                </p>
                {data.webhookInfo.pendingUpdates > 0 && (
                  <p className="text-sm text-orange-600">
                    {data.webhookInfo.pendingUpdates} atualização(ões) pendente(s)
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-700">
                ✗ Webhook não configurado. Configure em Configurações → Notificações
              </p>
            )}
          </CardContent>
        </Card>

        {/* Validadores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Validadores Configurados
            </CardTitle>
            <CardDescription>
              Status dos validadores e suas configurações do Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.validators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum validador cadastrado
              </p>
            ) : (
              <div className="space-y-3">
                {data.validators.map((validator) => (
                  <div
                    key={validator.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{validator.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Chat ID: {validator.telegram_chat_id || "(não configurado)"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {validator.notification_telegram ? (
                        <Badge variant="default" className="bg-green-600">
                          Telegram ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Telegram inativo
                        </Badge>
                      )}
                      {validator.telegram_chat_id ? (
                        <Badge variant="default" className="bg-blue-600">
                          Chat ID configurado
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Chat ID ausente
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Solicitações Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Últimas 5 Solicitações
            </CardTitle>
            <CardDescription>
              Solicitações recentes e validadores atribuídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma solicitação encontrada
              </p>
            ) : (
              <div className="space-y-2">
                {data.recentRequests.map((request) => (
                  <div
                    key={request.protocol}
                    className="flex items-center justify-between p-3 border rounded-lg text-sm"
                  >
                    <div>
                      <p className="font-medium">{request.protocol}</p>
                      <p className="text-muted-foreground">{request.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{request.status}</Badge>
                      {request.assigned_validator_id ? (
                        <p className="text-xs text-green-700 mt-1">
                          Validador #{request.assigned_validator_id}
                        </p>
                      ) : (
                        <p className="text-xs text-red-700 mt-1">
                          Sem validador
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teste de Envio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Testar Envio
            </CardTitle>
            <CardDescription>
              Enviar mensagem de teste para todos os validadores com Telegram ativo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={sendTestMessage}
                disabled={testing || !data.telegramToken.configured}
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Mensagem de Teste
                  </>
                )}
              </Button>
              
              {testResult && (
                <div className={`p-3 rounded-lg ${
                  testResult.startsWith("❌") 
                    ? "bg-red-50 text-red-700" 
                    : "bg-green-50 text-green-700"
                }`}>
                  {testResult}
                </div>
              )}

              {testDiagnostic && (
                <div className="mt-4 p-4 bg-slate-50 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Log Detalhado do Teste
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    {testDiagnostic.map((log: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white border rounded">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600 font-semibold min-w-[140px]">
                            {log.step}:
                          </span>
                          <div className="flex-1">
                            <p className="text-slate-700">{log.message}</p>
                            {log.tokenLength !== undefined && (
                              <p className="text-slate-500 mt-1">
                                Token length: {log.tokenLength}
                              </p>
                            )}
                            {log.validators && (
                              <div className="mt-2 space-y-1">
                                {log.validators.map((v: any, i: number) => (
                                  <p key={i} className="text-slate-600">
                                    • {v.name} (ID: {v.id}, Chat: {v.chatId})
                                  </p>
                                ))}
                              </div>
                            )}
                            {log.sendResults && (
                              <div className="mt-2 space-y-2">
                                {log.sendResults.map((r: any, i: number) => (
                                  <div key={i} className={`p-2 rounded ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <p className={r.success ? 'text-green-700' : 'text-red-700'}>
                                      {r.validatorName}: {r.message}
                                    </p>
                                    {r.response && !r.success && (
                                      <p className="text-red-600 text-xs mt-1">
                                        {JSON.stringify(r.response, null, 2)}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {log.timestamp && (
                              <p className="text-slate-400 mt-1 text-xs">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                              </p>
                            )}
                            {log.stack && (
                              <pre className="mt-2 p-2 bg-red-50 text-red-600 text-xs overflow-auto">
                                {log.stack}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!data.telegramToken.configured && (
                <p className="text-sm text-amber-600">
                  Configure o token do bot antes de enviar mensagens de teste
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </PageLayout>
  );
}
