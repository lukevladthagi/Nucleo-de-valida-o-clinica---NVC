"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Bell, CheckCircle, Settings } from "lucide-react";

export default function Notificacoes() {
  const [testingValidators, setTestingValidators] = useState(false);
  const [testingApproval, setTestingApproval] = useState(false);
  const [validatorTestResult, setValidatorTestResult] = useState<any>(null);
  const [approvalTestResult, setApprovalTestResult] = useState<any>(null);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [reconfiguringWebhook, setReconfiguringWebhook] = useState(false);
  const [reconfigResult, setReconfigResult] = useState<any>(null);

  const handleValidatorTest = async () => {
    setTestingValidators(true);
    setValidatorTestResult(null);
    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      setValidatorTestResult(data);
    } catch (error) {
      setValidatorTestResult({ error: "Erro ao enviar teste" });
    } finally {
      setTestingValidators(false);
    }
  };

  const handleApprovalTest = async () => {
    setTestingApproval(true);
    setApprovalTestResult(null);
    try {
      const response = await fetch("/api/telegram/test-approval", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      setApprovalTestResult(data);
    } catch (error) {
      setApprovalTestResult({ error: "Erro ao enviar teste" });
    } finally {
      setTestingApproval(false);
    }
  };

  const loadWebhookInfo = async () => {
    setLoadingWebhook(true);
    try {
      const response = await fetch("/api/telegram/webhook-info", {
        credentials: "include",
      });
      const data = await response.json();
      setWebhookInfo(data);
    } catch (error) {
      setWebhookInfo({ error: "Erro ao carregar informações" });
    } finally {
      setLoadingWebhook(false);
    }
  };

  const handleReconfigureWebhook = async () => {
    setReconfiguringWebhook(true);
    setReconfigResult(null);
    try {
      const response = await fetch("/api/telegram/reconfigure-webhook", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      setReconfigResult(data);
      // Reload webhook info after reconfiguration
      if (data.success) {
        setTimeout(() => loadWebhookInfo(), 1000);
      }
    } catch (error) {
      setReconfigResult({ error: "Erro ao reconfigurar webhook" });
    } finally {
      setReconfiguringWebhook(false);
    }
  };

  useEffect(() => {
    loadWebhookInfo();
  }, []);

  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-sm text-gray-500">Teste o sistema de notificações do Telegram</p>
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração do Webhook do Telegram
              </CardTitle>
              <CardDescription>
                Para que as aprovações funcionem corretamente, o webhook deve estar configurado para o ambiente de produção (nvc.mocha.app)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingWebhook ? (
                  <p className="text-sm text-gray-500">Carregando informações...</p>
                ) : webhookInfo?.error ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded">
                    {webhookInfo.error}
                  </div>
                ) : webhookInfo?.result ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-1">URL Atual do Webhook:</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border">
                        {webhookInfo.result.url || "Não configurado"}
                      </code>
                      
                      {webhookInfo.result.url && (
                        <div className="mt-2">
                          {webhookInfo.result.url.includes('nvc.mocha.app') ? (
                            <p className="text-sm text-green-600">✓ Webhook configurado corretamente para produção</p>
                          ) : (
                            <p className="text-sm text-orange-600">⚠ Webhook configurado para ambiente errado. Clique em "Reconfigurar" abaixo.</p>
                          )}
                        </div>
                      )}
                      
                      {webhookInfo.result.pending_update_count > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          Atualizações pendentes: {webhookInfo.result.pending_update_count}
                        </p>
                      )}
                      
                      {webhookInfo.result.last_error_message && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
                          <p className="font-semibold">Último erro:</p>
                          <p>{webhookInfo.result.last_error_message}</p>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      onClick={handleReconfigureWebhook} 
                      disabled={reconfiguringWebhook}
                      variant="default"
                    >
                      {reconfiguringWebhook ? "Reconfigurando..." : "Reconfigurar Webhook para Produção"}
                    </Button>

                    {reconfigResult && (
                      <div className={`p-4 rounded-lg ${reconfigResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {reconfigResult.success ? (
                          <div>
                            <p className="font-semibold">✓ Webhook reconfigurado com sucesso!</p>
                            <p className="text-sm mt-1">Nova URL: {reconfigResult.webhookUrl}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold">✗ Erro ao reconfigurar webhook</p>
                            <p className="text-sm mt-1">{reconfigResult.error}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Teste de Notificação - Nova Solicitação
              </CardTitle>
              <CardDescription>
                Envia uma mensagem de teste para todos os validadores com Telegram habilitado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleValidatorTest} 
                disabled={testingValidators}
              >
                {testingValidators ? "Enviando..." : "Enviar Teste para Validadores"}
              </Button>

              {validatorTestResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Log Detalhado do Teste</h3>
                  
                  {validatorTestResult.error ? (
                    <div className="text-red-600">
                      <p className="font-semibold">Erro:</p>
                      <p>{validatorTestResult.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-green-600 font-semibold">
                        ✓ Enviado para {validatorTestResult.sentTo} de {validatorTestResult.total} validadores
                      </p>
                    </div>
                  )}

                  {validatorTestResult.diagnostic && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        Ver detalhes completos
                      </summary>
                      <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                        {JSON.stringify(validatorTestResult.diagnostic, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Teste de Notificação - Aprovação
              </CardTitle>
              <CardDescription>
                Envia uma mensagem de teste de aprovação para todos os enfermeiros e solicitantes com Telegram habilitado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleApprovalTest} 
                disabled={testingApproval}
                variant="outline"
              >
                {testingApproval ? "Enviando..." : "Enviar Teste para Enfermeiros e Solicitantes"}
              </Button>

              {approvalTestResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Log Detalhado do Teste</h3>
                  
                  {approvalTestResult.error ? (
                    <div className="text-red-600">
                      <p className="font-semibold">Erro:</p>
                      <p>{approvalTestResult.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-green-600 font-semibold">
                        ✓ Enviado para {approvalTestResult.sentTo} de {approvalTestResult.total} destinatários
                      </p>
                      <div className="text-sm text-gray-600">
                        <p>• Enfermeiros: {approvalTestResult.totalNurses}</p>
                        <p>• Solicitantes: {approvalTestResult.totalRequesters}</p>
                      </div>
                    </div>
                  )}

                  {approvalTestResult.diagnostic && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        Ver detalhes completos
                      </summary>
                      <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                        {JSON.stringify(approvalTestResult.diagnostic, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
