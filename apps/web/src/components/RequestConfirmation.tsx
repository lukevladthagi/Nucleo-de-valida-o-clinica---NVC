"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";
import type { CreatedRequest } from "@/shared/types";

interface ConfirmationProps {
  result: CreatedRequest;
  onNewRequest: () => void;
}

export default function RequestConfirmation({ result, onNewRequest }: ConfirmationProps) {
  const priorityColors = {
    imediata: "text-red-600 bg-red-50 border-red-200",
    urgente: "text-yellow-700 bg-yellow-50 border-yellow-200",
    eletiva: "text-blue-600 bg-blue-50 border-blue-200",
  };

  const priorityLabels = {
    imediata: "Imediata",
    urgente: "Urgente",
    eletiva: "Eletiva",
  };

  const statusLabels = {
    aguardando_validacao: "Aguardando validação",
    enviada: "Enviada",
  };

  const priorityColor = priorityColors[result.priority as keyof typeof priorityColors] || priorityColors.eletiva;
  const priorityLabel = priorityLabels[result.priority as keyof typeof priorityLabels] || result.priority;
  const statusLabel = statusLabels[result.status as keyof typeof statusLabels] || result.status;
  
  // Auto-redirect to new request after 5 seconds
  setTimeout(() => {
    onNewRequest();
  }, 5000);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-8">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl mb-2">Solicitação Enviada com Sucesso</CardTitle>
            <p className="text-muted-foreground">
              Sua solicitação de pré-internação foi registrada e enviada para validação
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Protocol Number */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Número do protocolo</div>
            <div className="text-2xl font-mono font-bold text-primary">{result.protocol}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Guarde este número para acompanhar sua solicitação
            </div>
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Status</div>
              </div>
              <div className="text-lg font-semibold">{statusLabel}</div>
            </div>

            <div className={`border rounded-lg p-4 ${priorityColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <div className="text-sm font-medium">Prioridade</div>
              </div>
              <div className="text-lg font-semibold">{priorityLabel}</div>
            </div>
          </div>

          {/* SLA Information */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Prazo de Resposta (SLA)</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold">{result.slaMinutes} minutos</div>
              <div className="text-sm text-muted-foreground">
                Resposta esperada até:{" "}
                {new Date(result.slaDeadline).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* Priority Alert */}
          {result.priority === "imediata" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900 mb-1">
                    Caso elegível para Fast-Track
                  </div>
                  <div className="text-sm text-red-700">
                    Esta solicitação foi classificada como imediata. Os médicos validadores
                    foram notificados com prioridade máxima.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="font-semibold mb-2">Próximos passos</div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• Os médicos validadores foram notificados da solicitação</li>
              <li>• Você receberá a decisão dentro do prazo estabelecido</li>
              <li>• Use o número do protocolo para acompanhar o status</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={onNewRequest}
              variant="outline"
              className="flex-1"
            >
              Nova solicitação
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="flex-1"
            >
              Imprimir comprovante
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
