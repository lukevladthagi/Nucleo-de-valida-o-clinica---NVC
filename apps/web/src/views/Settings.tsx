"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Link as LinkIcon, 
  Clock, 
  Save,
  Loader2,
  CheckCircle,
  Lock,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface Setting {
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [mvsoulTestLoading, setMvsoulTestLoading] = useState(false);
  const [mvsoulTestStatus, setMvsoulTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mvsoulTestMessage, setMvsoulTestMessage] = useState('');
  const [mvsoulTestNumber, setMvsoulTestNumber] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Erro ao carregar configurações");
      const data: Setting[] = await response.json();
      
      const settingsMap: Record<string, string> = {};
      data.forEach(setting => {
        settingsMap[setting.setting_key] = setting.setting_value || "";
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) throw new Error("Erro ao salvar configurações");
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof value === "boolean" ? (value ? "1" : "0") : value
    }));
  };

  const getBooleanValue = (key: string): boolean => {
    return settings[key] === "1";
  };

  const configureWebhook = async () => {
    const token = settings.telegram_bot_token;
    if (!token) {
      setWebhookStatus('error');
      setWebhookMessage('Configure o token do bot primeiro');
      setTimeout(() => setWebhookStatus('idle'), 3000);
      return;
    }

    setWebhookLoading(true);
    setWebhookStatus('idle');
    setWebhookMessage('');

    try {
      const webhookUrl = 'https://ndi.mocha.app/api/telegram/webhook';
      const response = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
      );
      
      const data = await response.json();
      
      if (data.ok) {
        setWebhookStatus('success');
        setWebhookMessage('Webhook configurado com sucesso! O bot já pode responder com Chat IDs.');
      } else {
        setWebhookStatus('error');
        setWebhookMessage(`Erro: ${data.description || 'Token inválido ou erro desconhecido'}`);
      }
    } catch (error) {
      setWebhookStatus('error');
      setWebhookMessage('Erro ao conectar com a API do Telegram');
    } finally {
      setWebhookLoading(false);
      setTimeout(() => {
        setWebhookStatus('idle');
        setWebhookMessage('');
      }, 5000);
    }
  };

  const testMvsoulConnection = async () => {
    if (!mvsoulTestNumber.trim()) {
      setMvsoulTestStatus('error');
      setMvsoulTestMessage('Digite um número de atendimento para testar');
      setTimeout(() => setMvsoulTestStatus('idle'), 3000);
      return;
    }

    setMvsoulTestLoading(true);
    setMvsoulTestStatus('idle');
    setMvsoulTestMessage('');

    try {
      const response = await fetch(
        `/api/mvsoul/patient/${mvsoulTestNumber.trim()}`
      );
      
      const data = await response.json();
      
      // Extract diagnostic log if present
      const diagnostic = data._diagnostic || data.diagnostic || [];
      const diagnosticText = diagnostic.length > 0 
        ? '\n\nLog de diagnóstico:\n' + diagnostic.join('\n')
        : '';
      
      if (!response.ok) {
        setMvsoulTestStatus('error');
        setMvsoulTestMessage(
          `❌ Erro: ${data.error || 'Atendimento não encontrado'}${diagnosticText}`
        );
        return;
      }
      
      setMvsoulTestStatus('success');
      setMvsoulTestMessage(
        `✅ Conexão bem-sucedida!\n` +
        `Paciente: ${data.nm_paciente || 'N/A'}\n` +
        `Nascimento: ${data.dt_nascimento || 'N/A'}\n` +
        `Sexo: ${data.tp_sexo || 'N/A'}\n` +
        `Convênio: ${data.nm_convenio || 'N/A'}${diagnosticText}`
      );
    } catch (error) {
      setMvsoulTestStatus('error');
      setMvsoulTestMessage(
        error instanceof Error 
          ? `❌ ${error.message}` 
          : '❌ Erro ao conectar com a API do MVSOUL'
      );
    } finally {
      setMvsoulTestLoading(false);
      setTimeout(() => {
        setMvsoulTestStatus('idle');
        setMvsoulTestMessage('');
      }, 8000);
    }
  };

  const handleCleanupTestData = async () => {
    if (cleanupConfirm !== 'LIMPAR') {
      alert('Digite LIMPAR para confirmar a exclusão');
      return;
    }

    if (!window.confirm(
      '⚠️ ATENÇÃO: Esta ação irá excluir PERMANENTEMENTE:\n\n' +
      '- Todas as solicitações\n' +
      '- Todas as notificações\n' +
      '- Todos os anexos\n\n' +
      'Os cadastros de usuários, validadores, enfermeiros e solicitantes serão mantidos.\n\n' +
      'Deseja realmente continuar?'
    )) {
      return;
    }

    setCleanupLoading(true);
    try {
      const response = await fetch('/api/cleanup-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao limpar dados');
      }

      alert(
        '✅ Dados de teste excluídos com sucesso!\n\n' +
        `- ${data.requestsDeleted} solicitações excluídas\n` +
        `- ${data.notificationsDeleted} notificações excluídas\n` +
        `- ${data.attachmentsDeleted} anexos excluídos`
      );
      
      setCleanupConfirm('');
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      alert('Erro ao limpar dados de teste. Verifique os logs.');
    } finally {
      setCleanupLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Configurações do Sistema</h1>
              <p className="text-slate-600">Gerencie SLA, notificações e integrações</p>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? "Salvando..." : saveSuccess ? "Salvo!" : "Salvar Alterações"}
            </Button>
          </div>

          <Tabs defaultValue="notifications" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="mvsoul">
                <LinkIcon className="h-4 w-4 mr-2" />
                MVSOUL
              </TabsTrigger>
              <TabsTrigger value="sla">
                <Clock className="h-4 w-4 mr-2" />
                SLA
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="h-4 w-4 mr-2" />
                Segurança
              </TabsTrigger>
              <TabsTrigger value="cleanup">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpeza
              </TabsTrigger>
            </TabsList>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              {/* Email Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>E-mail</CardTitle>
                  <CardDescription>
                    Configuração de notificações por e-mail (via Mocha Email Service)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar notificações por e-mail</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar notificações para validadores via e-mail
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("email_enabled")}
                      onCheckedChange={(checked) => updateSetting("email_enabled", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* WhatsApp Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp</CardTitle>
                  <CardDescription>
                    Configuração de notificações via WhatsApp API
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar notificações por WhatsApp</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar notificações para validadores via WhatsApp
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("whatsapp_enabled")}
                      onCheckedChange={(checked) => updateSetting("whatsapp_enabled", checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_api_url">URL da API do WhatsApp</Label>
                    <Input
                      id="whatsapp_api_url"
                      placeholder="https://api.whatsapp.com/..."
                      value={settings.whatsapp_api_url || ""}
                      onChange={(e) => updateSetting("whatsapp_api_url", e.target.value)}
                      disabled={!getBooleanValue("whatsapp_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL base da API do WhatsApp Business ou serviço similar
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_api_token">Token de Autenticação</Label>
                    <Input
                      id="whatsapp_api_token"
                      type="password"
                      placeholder="Token da API..."
                      value={settings.whatsapp_api_token || ""}
                      onChange={(e) => updateSetting("whatsapp_api_token", e.target.value)}
                      disabled={!getBooleanValue("whatsapp_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Token de autenticação fornecido pelo serviço de WhatsApp
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Telegram Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Telegram</CardTitle>
                  <CardDescription>
                    Configuração de notificações via Telegram Bot
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar notificações por Telegram</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar notificações para validadores via Telegram
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("telegram_enabled")}
                      onCheckedChange={(checked) => updateSetting("telegram_enabled", checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="telegram_bot_token">Token do Bot</Label>
                    <Input
                      id="telegram_bot_token"
                      type="password"
                      placeholder="123456:ABC-DEF..."
                      value={settings.telegram_bot_token || ""}
                      onChange={(e) => updateSetting("telegram_bot_token", e.target.value)}
                      disabled={!getBooleanValue("telegram_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Token fornecido pelo @BotFather ao criar o bot
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button 
                      onClick={configureWebhook}
                      disabled={webhookLoading || !settings.telegram_bot_token || !getBooleanValue("telegram_enabled")}
                      variant={webhookStatus === 'success' ? 'default' : webhookStatus === 'error' ? 'destructive' : 'outline'}
                      className="w-full"
                    >
                      {webhookLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Configurando webhook...
                        </>
                      ) : webhookStatus === 'success' ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Webhook Configurado
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Configurar Webhook
                        </>
                      )}
                    </Button>
                    {webhookMessage && (
                      <p className={`text-sm ${webhookStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {webhookMessage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Clique aqui após salvar o token. Isso permite que o bot responda automaticamente com o Chat ID.
                    </p>
                  </div>

                  <Separator />

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-900 font-semibold mb-3">
                      📱 Passo a passo para ativar o Telegram:
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-white rounded p-3 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-1">1️⃣ Criar o bot</p>
                        <p className="text-sm text-blue-800">
                          Abra o Telegram, fale com <strong>@BotFather</strong> e envie <code className="bg-blue-100 px-1 rounded">/newbot</code>
                        </p>
                        <p className="text-sm text-blue-800 mt-1">
                          Siga as instruções, escolha um nome e copie o <strong>token</strong> que ele fornecer
                        </p>
                      </div>

                      <div className="bg-white rounded p-3 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-1">2️⃣ Cole o token e salve</p>
                        <p className="text-sm text-blue-800">
                          Cole o token no campo acima, marque "Habilitar notificações por Telegram" e clique em <strong>"Salvar Alterações"</strong>
                        </p>
                      </div>

                      <div className="bg-white rounded p-3 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-1">3️⃣ Configure o webhook</p>
                        <p className="text-sm text-blue-800">
                          Clique no botão <strong>"Configurar Webhook"</strong> acima. Se aparecer "Webhook Configurado", está pronto!
                        </p>
                      </div>

                      <div className="bg-white rounded p-3 border border-green-200">
                        <p className="text-sm font-semibold text-green-900 mb-1">✅ Pronto! Como os validadores obtêm o Chat ID:</p>
                        <p className="text-sm text-green-800">
                          Cada validador deve enviar /start para o bot. O bot responderá automaticamente com o Chat ID dele.
                          Esse Chat ID deve ser cadastrado na área "Validadores" para receber notificações.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MVSOUL Integration Tab */}
            <TabsContent value="mvsoul" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integração com MVSOUL</CardTitle>
                  <CardDescription>
                    Configure os parâmetros de conexão e sincronização com o sistema MVSOUL
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar integração com MVSOUL</Label>
                      <p className="text-sm text-muted-foreground">
                        Ativar comunicação com o sistema MVSOUL
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("mvsoul_integration_enabled")}
                      onCheckedChange={(checked) => updateSetting("mvsoul_integration_enabled", checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="mvsoul_api_url">URL da API do MVSOUL</Label>
                    <Input
                      id="mvsoul_api_url"
                      placeholder="https://api.mvsoul.com.br/..."
                      value={settings.mvsoul_api_url || ""}
                      onChange={(e) => updateSetting("mvsoul_api_url", e.target.value)}
                      disabled={!getBooleanValue("mvsoul_integration_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL base da API REST do MVSOUL
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mvsoul_api_user">Usuário da API</Label>
                    <Input
                      id="mvsoul_api_user"
                      placeholder="usuario_api"
                      value={settings.mvsoul_api_user || ""}
                      onChange={(e) => updateSetting("mvsoul_api_user", e.target.value)}
                      disabled={!getBooleanValue("mvsoul_integration_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome de usuário para autenticação na API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mvsoul_api_password">Senha da API</Label>
                    <Input
                      id="mvsoul_api_password"
                      type="password"
                      placeholder="••••••••"
                      value={settings.mvsoul_api_password || ""}
                      onChange={(e) => updateSetting("mvsoul_api_password", e.target.value)}
                      disabled={!getBooleanValue("mvsoul_integration_enabled")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Senha para autenticação na API do MVSOUL
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sincronização automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Buscar dados de pacientes automaticamente do MVSOUL ao informar número de atendimento
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("mvsoul_auto_sync")}
                      onCheckedChange={(checked) => updateSetting("mvsoul_auto_sync", checked)}
                      disabled={!getBooleanValue("mvsoul_integration_enabled")}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mvsoul_test_number">Testar Conexão com MVSOUL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="mvsoul_test_number"
                          placeholder="Digite um número de atendimento"
                          value={mvsoulTestNumber}
                          onChange={(e) => setMvsoulTestNumber(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={testMvsoulConnection}
                          disabled={mvsoulTestLoading}
                          variant={mvsoulTestStatus === 'success' ? 'default' : mvsoulTestStatus === 'error' ? 'destructive' : 'outline'}
                        >
                          {mvsoulTestLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Testando...
                            </>
                          ) : mvsoulTestStatus === 'success' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Sucesso
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Testar
                            </>
                          )}
                        </Button>
                      </div>
                      {mvsoulTestMessage && (
                        <div className={`text-sm whitespace-pre-line p-3 rounded-md border ${
                          mvsoulTestStatus === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          {mvsoulTestMessage}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Digite um número de atendimento válido e clique em "Testar" para verificar a conexão com a API do MVSOUL
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <p className="text-sm text-blue-900">
                      <strong>Funcionalidades previstas:</strong>
                    </p>
                    <ul className="text-sm text-blue-800 list-disc list-inside mt-2 space-y-1">
                      <li>Buscar dados do paciente pelo número de atendimento</li>
                      <li>Buscar convênio e médico assistente</li>
                      <li>Consultar exames já realizados</li>
                      <li>Registrar protocolo de internação no MVSOUL</li>
                      <li>Atualizar status da solicitação no prontuário</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SLA Tab */}
            <TabsContent value="sla" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tempos de SLA</CardTitle>
                  <CardDescription>
                    Defina os tempos de resposta esperados para cada nível de prioridade
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="sla_immediate">Prioridade Imediata / Fast-Track</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sla_immediate"
                        type="number"
                        min="1"
                        max="60"
                        value={settings.sla_immediate_minutes || "5"}
                        onChange={(e) => updateSetting("sla_immediate_minutes", e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tempo máximo para validação de casos críticos (dor torácica + troponina, instabilidade)
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="sla_urgent">Prioridade Urgente</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sla_urgent"
                        type="number"
                        min="1"
                        max="120"
                        value={settings.sla_urgent_minutes || "10"}
                        onChange={(e) => updateSetting("sla_urgent_minutes", e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tempo máximo para validação de casos urgentes (risco moderado, DAC importante)
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="sla_elective">Prioridade Eletiva</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sla_elective"
                        type="number"
                        min="1"
                        max="240"
                        value={settings.sla_elective_minutes || "30"}
                        onChange={(e) => updateSetting("sla_elective_minutes", e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tempo máximo para validação de casos eletivos (risco baixo, sem instabilidade)
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                    <p className="text-sm text-amber-900">
                      <strong>Atenção:</strong> Alterações nos tempos de SLA afetarão apenas novas solicitações.
                      Solicitações existentes manterão o SLA calculado no momento da criação.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Segurança do Formulário Público</CardTitle>
                  <CardDescription>
                    Configure proteção de acesso ao formulário de solicitações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar acesso seguro</Label>
                      <p className="text-sm text-muted-foreground">
                        Exigir código de acesso para abrir o formulário público
                      </p>
                    </div>
                    <Switch
                      checked={getBooleanValue("form_access_secure")}
                      onCheckedChange={(checked) => updateSetting("form_access_secure", checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="form_access_code">Código de Acesso</Label>
                    <div className="relative">
                      <Input
                        id="form_access_code"
                        type={getBooleanValue("show_access_code") ? "text" : "password"}
                        placeholder="Digite um código de acesso"
                        value={settings.form_access_code || ""}
                        onChange={(e) => updateSetting("form_access_code", e.target.value)}
                        disabled={!getBooleanValue("form_access_secure")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => updateSetting("show_access_code", !getBooleanValue("show_access_code"))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {getBooleanValue("show_access_code") ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Código que os enfermeiros precisarão digitar para acessar o formulário
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>URL do Formulário</Label>
                    <div className="flex gap-2">
                      <Input
                        value={window.location.origin + "/ndir-secure-s9k3m7x2p"}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + "/ndir-secure-s9k3m7x2p");
                          alert("URL copiada para a área de transferência!");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compartilhe esta URL com os enfermeiros autorizados
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Como funciona a proteção:
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>URL obscura:</strong> /ndir-secure-s9k3m7x2p (difícil de adivinhar)</li>
                      <li>• <strong>Código de acesso:</strong> Exigido ao abrir o formulário</li>
                      <li>• <strong>Sessão:</strong> Código válido por sessão do navegador</li>
                      <li>• <strong>Dados protegidos:</strong> Laudos e exames do MVSOUL só acessíveis após autenticação</li>
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      <strong>Importante:</strong> O código de acesso protege contra acessos não autorizados externos.
                      Para acesso completo ao sistema (validação, configurações, relatórios), continue usando o login administrativo.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cleanup Tab */}
            <TabsContent value="cleanup" className="space-y-6">
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Limpeza de Dados de Teste
                  </CardTitle>
                  <CardDescription>
                    Remova todas as solicitações e notificações de teste do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-900 mb-2">
                      ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL
                    </p>
                    <p className="text-sm text-red-800 mb-3">
                      Esta operação irá excluir permanentemente:
                    </p>
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      <li>Todas as solicitações de pré-internação</li>
                      <li>Todas as notificações registradas</li>
                      <li>Todos os anexos enviados</li>
                    </ul>
                    <p className="text-sm text-red-800 mt-3 font-semibold">
                      Serão mantidos:
                    </p>
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      <li>Cadastros de usuários</li>
                      <li>Cadastros de validadores</li>
                      <li>Cadastros de enfermeiros</li>
                      <li>Cadastros de solicitantes (médicos)</li>
                      <li>Configurações do sistema</li>
                    </ul>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cleanup_confirm" className="text-red-700 font-semibold">
                        Para confirmar, digite: LIMPAR
                      </Label>
                      <Input
                        id="cleanup_confirm"
                        placeholder="Digite LIMPAR em letras maiúsculas"
                        value={cleanupConfirm}
                        onChange={(e) => setCleanupConfirm(e.target.value)}
                        className="font-mono"
                      />
                    </div>

                    <Button
                      onClick={handleCleanupTestData}
                      disabled={cleanupLoading || cleanupConfirm !== 'LIMPAR'}
                      variant="destructive"
                      size="lg"
                      className="w-full"
                    >
                      {cleanupLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Excluindo dados...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Todos os Dados de Teste
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      <strong>Quando usar:</strong> Esta ferramenta deve ser usada quando você terminar 
                      de testar o sistema e estiver pronto para começar a operação real. Todos os testes 
                      e solicitações de exemplo serão removidos, deixando o sistema limpo para produção.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
