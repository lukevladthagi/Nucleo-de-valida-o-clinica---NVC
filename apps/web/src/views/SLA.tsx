"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Save, Clock } from "lucide-react";

interface Settings {
  sla_immediate_minutes: string;
  sla_urgent_minutes: string;
  sla_elective_minutes: string;
}

export default function SLA() {
  const [settings, setSettings] = useState<Settings>({
    sla_immediate_minutes: "10",
    sla_urgent_minutes: "15",
    sla_elective_minutes: "30",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        credentials: "include",
      });
      const data = await response.json();
      
      const settingsMap: any = {};
      data.forEach((setting: any) => {
        if (setting.setting_key.startsWith('sla_')) {
          settingsMap[setting.setting_key] = setting.setting_value;
        }
      });
      
      setSettings(prev => ({
        ...prev,
        ...settingsMap,
      }));
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar");
      }

      setSaveMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof Settings, value: string) => {
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">SLA - Tempo de Resposta</h1>
          <p className="text-sm text-gray-500">Configure os tempos máximos de resposta para cada prioridade</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tempos de SLA
            </CardTitle>
            <CardDescription>
              Defina o tempo máximo em minutos para validação de cada tipo de solicitação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="immediate" className="flex items-center gap-2">
                🔴 Prioridade IMEDIATA
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="immediate"
                  type="text"
                  inputMode="numeric"
                  value={settings.sla_immediate_minutes}
                  onChange={(e) => handleChange('sla_immediate_minutes', e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">minutos</span>
              </div>
              <p className="text-xs text-gray-500">
                Para casos críticos que requerem resposta imediata
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgent" className="flex items-center gap-2">
                🟡 Prioridade URGENTE
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="urgent"
                  type="text"
                  inputMode="numeric"
                  value={settings.sla_urgent_minutes}
                  onChange={(e) => handleChange('sla_urgent_minutes', e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">minutos</span>
              </div>
              <p className="text-xs text-gray-500">
                Para casos que necessitam resposta rápida mas não imediata
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="elective" className="flex items-center gap-2">
                🔵 Prioridade ELETIVA
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="elective"
                  type="text"
                  inputMode="numeric"
                  value={settings.sla_elective_minutes}
                  onChange={(e) => handleChange('sla_elective_minutes', e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">minutos</span>
              </div>
              <p className="text-xs text-gray-500">
                Para casos programados sem urgência
              </p>
            </div>

            <div className="pt-4 border-t flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
              
              {saveMessage && (
                <p className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage.text}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
