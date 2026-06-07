"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-shim";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageLayout from "@/components/PageLayout";
import {
  User,
  FileText,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  ImageIcon,
  Paperclip,
  Download,
} from "lucide-react";

export default function ValidatorPage() {
  const { protocol } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slaRemaining, setSlaRemaining] = useState<string>("");
  const [isSlaExpired, setIsSlaExpired] = useState(false);

  const [decisionData, setDecisionData] = useState({
    validatorPhysician: "",
    validatorCrm: "",
    decisionJustification: "",
    decisionObservation: "",
  });

  // Laudos and exames
  const [laudos, setLaudos] = useState<any[]>([]);
  const [laudosModalOpen, setLaudosModalOpen] = useState(false);
  const [loadingLaudos, setLoadingLaudos] = useState(false);
  const [laudoStatus, setLaudoStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({});

  const [exames, setExames] = useState<any[]>([]);
  const [examesModalOpen, setExamesModalOpen] = useState(false);
  const [loadingExames, setLoadingExames] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  
  // Diagnostic modal
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);

  useEffect(() => {
    if (!protocol) {
      setError("Protocolo não informado");
      setLoading(false);
      return;
    }

    fetchRequest();
  }, [protocol]);

  useEffect(() => {
    if (!request?.sla_deadline) return;

    const updateSLA = () => {
      const deadline = new Date(request.sla_deadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsSlaExpired(true);
        setSlaRemaining("SLA vencido");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setSlaRemaining(`${minutes}m ${seconds}s`);
    };

    updateSLA();
    const interval = setInterval(updateSLA, 1000);

    return () => clearInterval(interval);
  }, [request]);

  const fetchRequest = async () => {
    try {
      const response = await fetch(`/api/requests/${protocol}`);
      if (!response.ok) {
        throw new Error("Solicitação não encontrada");
      }
      const data = await response.json();
      setRequest(data);
      
      // Fetch attachments if request has ID
      if (data.id) {
        fetchAttachments(data.id);
      }
    } catch (err) {
      setError("Erro ao carregar solicitação");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async (requestId: number) => {
    try {
      const response = await fetch(`/api/requests/${requestId}/attachments`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const fetchLaudos = async () => {
    if (!request?.mvsoul_number) return;
    
    setLoadingLaudos(true);
    try {
      const response = await fetch(`/api/mvsoul/laudo?paciente_id=${request.mvsoul_number}`);
      if (!response.ok) throw new Error("Erro ao buscar laudos");
      
      const data = await response.json();
      setLaudos(data.results || []);
      setLaudosModalOpen(true);
    } catch (error) {
      console.error("Error fetching laudos:", error);
      alert("Erro ao buscar laudos do paciente");
    } finally {
      setLoadingLaudos(false);
    }
  };

  const fetchExames = async () => {
    if (!request?.mvsoul_number) return;
    
    setLoadingExames(true);
    try {
      const response = await fetch(`/api/mvsoul/laudo?paciente_id=${request.mvsoul_number}`);
      if (!response.ok) throw new Error("Erro ao buscar exames");
      
      const data = await response.json();
      const examesComVisualizador = (data.results || []).filter((item: any) => item.id_exame_pedido);
      setExames(examesComVisualizador);
      setExamesModalOpen(true);
    } catch (error) {
      console.error("Error fetching exames:", error);
      alert("Erro ao buscar exames do paciente");
    } finally {
      setLoadingExames(false);
    }
  };

  const openLaudoPdf = async (idExamePedido: string) => {
    setLaudoStatus(prev => ({ ...prev, [idExamePedido]: 'loading' }));
    
    try {
      const laudo = laudos.find((l: any) => l.id_exame_pedido === idExamePedido);
      
      if (laudo && (laudo.ds_laudo_rtf || laudo.ds_laudo_txt)) {
        console.log("[LAUDO] Has text content, skipping PDF");
        setLaudoStatus(prev => ({ ...prev, [idExamePedido]: 'error' }));
        return;
      }

      const response = await fetch(`/api/mvsoul/laudo/pdf/${idExamePedido}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'not_pdf') {
          setLaudoStatus(prev => ({ ...prev, [idExamePedido]: 'error' }));
          return;
        }
        throw new Error("Erro ao buscar PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setLaudoStatus(prev => ({ ...prev, [idExamePedido]: 'success' }));
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Error opening laudo PDF:", error);
      setLaudoStatus(prev => ({ ...prev, [idExamePedido]: 'error' }));
    }
  };

  const openExameVisualizador = async (idExamePedido: string) => {
    try {
      const response = await fetch(`/api/mvsoul/pacs/${idExamePedido}/visualizador`);
      if (!response.ok) throw new Error("Erro ao buscar visualizador");
      
      const data = await response.json();
      if (data.link) {
        window.open(data.link, '_blank');
      } else {
        alert("Visualizador não disponível para este exame");
      }
    } catch (error) {
      console.error("Error opening visualizador:", error);
      alert("Erro ao abrir visualizador do exame");
    }
  };

  const downloadAttachment = async (attachmentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/requests/attachments/${attachmentId}/download`);
      if (!response.ok) throw new Error("Erro ao baixar anexo");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      alert("Erro ao baixar anexo");
    }
  };

  const handleDecision = async (decision: string) => {
    // Validate required fields
    if (!decisionData.validatorPhysician || !decisionData.validatorCrm) {
      alert("Por favor, preencha o nome e CRM do médico validador");
      return;
    }

    // Justification is only required for "negada" decision
    if (decision === "negada" && !decisionData.decisionJustification) {
      alert("Por favor, preencha a justificativa para negar a solicitação");
      return;
    }

    setSubmitting(true);
    setDiagnosticData(null);
    try {
      const response = await fetch(`/api/requests/${protocol}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          ...decisionData,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao registrar decisão");
      }

      const result = await response.json();
      
      // Show diagnostic for approvals
      if ((decision === "aprovada" || decision === "aprovada_com_observacao") && result.diagnostic) {
        setDiagnosticData(result.diagnostic);
        setDiagnosticModalOpen(true);
      } else {
        alert("Decisão registrada com sucesso!");
        navigate("/fila");
      }
    } catch (err) {
      alert("Erro ao registrar decisão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="bg-gradient-to-br from-blue-50 to-white h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Carregando solicitação...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !request) {
    return (
      <PageLayout>
        <div className="bg-gradient-to-br from-blue-50 to-white h-screen flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro</h2>
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  const priorityColors = {
    imediata: "bg-red-600 text-white",
    urgente: "bg-yellow-600 text-white",
    eletiva: "bg-blue-600 text-white",
  };

  const priorityLabels = {
    imediata: "Imediata",
    urgente: "Urgente",
    eletiva: "Eletiva",
  };

  const riskLabels = {
    alto: "Alto",
    moderado: "Moderado",
    baixo: "Baixo",
  };

  const priorityColor = priorityColors[request.priority_classification as keyof typeof priorityColors] || priorityColors.eletiva;
  const priorityLabel = priorityLabels[request.priority_classification as keyof typeof priorityLabels] || request.priority_classification;
  const riskLabel = riskLabels[request.clinical_risk as keyof typeof riskLabels] || request.clinical_risk;

  const infectionSigns = request.infection_signs ? JSON.parse(request.infection_signs) : [];

  // Check if already decided
  const isDecided = request.status !== "aguardando_validacao" && request.decision;

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-blue-50 to-white py-8">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex flex-col items-center gap-4 mb-3">
              <img 
                src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png" 
                alt="Núcleo de Validação Clínica"
                className="h-20"
              />
              <h1 className="text-3xl font-bold text-gray-900">Validação de Pré-Internação</h1>
            </div>
          </div>

        {/* Protocol and SLA */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Protocolo</div>
                <div className="text-xl font-mono font-bold text-primary">{request.protocol}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Prioridade</div>
                <Badge className={priorityColor}>{priorityLabel}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">SLA Restante</div>
                <div className={`text-xl font-bold ${isSlaExpired ? "text-red-600" : "text-gray-900"}`}>
                  {slaRemaining}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Prontuário</div>
                <div className="font-medium">{request.medical_record_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Nome</div>
                <div className="font-medium">{request.patient_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Idade / Sexo</div>
                <div className="font-medium">{request.age} anos / {request.sex === "masculino" ? "Masculino" : "Feminino"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Convênio</div>
                <div className="font-medium">{request.insurance}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Atendimento MVSOUL</div>
                <div className="font-medium">{request.mvsoul_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Médico Assistente</div>
                <div className="font-medium">{request.attending_physician}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Origem</div>
                <div className="font-medium capitalize">{request.origin}</div>
              </div>
            </div>

            {/* Buttons for Laudos and Exames */}
            {request.mvsoul_number && (
              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  onClick={fetchLaudos}
                  disabled={loadingLaudos}
                  variant="outline"
                  className="flex-1"
                >
                  {loadingLaudos ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Laudos do Paciente
                </Button>
                <Button
                  type="button"
                  onClick={fetchExames}
                  disabled={loadingExames}
                  variant="outline"
                  className="flex-1"
                >
                  {loadingExames ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  Exames do Paciente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Data */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Dados Clínicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Quadro Clínico Atual</div>
              <div className="text-sm">{request.clinical_presentation}</div>
            </div>
            {request.symptom_duration && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Tempo de Evolução</div>
                <div className="text-sm">{request.symptom_duration}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Hipótese Diagnóstica Principal</div>
              <div className="text-sm">{request.primary_diagnosis}</div>
            </div>
            {request.differential_diagnosis && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Diagnósticos Diferenciais</div>
                <div className="text-sm">{request.differential_diagnosis}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objective Data */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Dados Objetivos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">ECG</div>
                <div className="text-sm">{request.ecg}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Troponina</div>
                <div className="text-sm">{request.troponin}</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Sinais Vitais</div>
              <div className="text-sm">{request.vital_signs}</div>
            </div>
            {request.echocardiogram && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Ecocardiograma</div>
                <div className="text-sm">{request.echocardiogram}</div>
              </div>
            )}
            {request.other_exams && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Outros Exames</div>
                <div className="text-sm">{request.other_exams}</div>
              </div>
            )}
            {request.lab_results && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Exames Laboratoriais</div>
                <div className="text-sm">{request.lab_results}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Infectious Assessment */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Avaliação Infecciosa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Quadro Infeccioso Ativo</div>
                <div className="text-sm">{request.has_active_infection === "sim" ? "Sim" : "Não"}</div>
              </div>
              {infectionSigns.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-muted-foreground mb-1">Sinais de Infecção</div>
                  <div className="text-sm">{infectionSigns.join(", ")}</div>
                </div>
              )}
            </div>
            {request.infectious_focus && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Foco Provável</div>
                <div className="text-sm">{request.infectious_focus}</div>
              </div>
            )}
            {request.cardiac_justification && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">
                  Justificativa para Internação Cardiológica
                </div>
                <div className="text-sm">{request.cardiac_justification}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admission Justification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Justificativa da Internação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Justificativa Clínica</div>
              <div className="text-sm">{request.admission_justification}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Risco Clínico</div>
                <Badge variant="outline">{riskLabel}</Badge>
              </div>
            </div>
            {request.risk_justification && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-1">Justificativa do Risco</div>
                <div className="text-sm">{request.risk_justification}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Plano Intra-Hospitalar</div>
              <div className="text-sm">{request.inpatient_plan}</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Benefício Esperado</div>
              <div className="text-sm">{request.expected_benefit}</div>
            </div>
          </CardContent>
        </Card>

        {/* Requesting Physician */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Médico Solicitante</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Nome</div>
              <div className="font-medium">{request.requesting_physician}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CRM</div>
              <div className="font-medium">{request.crm}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Data/Hora da Solicitação</div>
              <div className="font-medium">
                {new Date(request.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attachments.map((attachment: any) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium text-sm">{attachment.file_name}</div>
                        <div className="text-xs text-gray-500">
                          {(attachment.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadAttachment(attachment.id, attachment.file_name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decision Section */}
        {isDecided ? (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle2 className="h-5 w-5" />
                Decisão Registrada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Decisão</div>
                  <div className="font-medium capitalize">{request.decision?.replace("_", " ")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Médico Validador</div>
                  <div className="font-medium">{request.validator_physician} - CRM {request.validator_crm}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Justificativa</div>
                <div className="text-sm">{request.decision_justification}</div>
              </div>
              {request.decision_observation && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Observação</div>
                  <div className="text-sm">{request.decision_observation}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Data/Hora da Decisão</div>
                <div className="font-medium">
                  {new Date(request.decision_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Registrar Decisão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="validatorPhysician">Nome do médico validador *</Label>
                  <Input
                    id="validatorPhysician"
                    value={decisionData.validatorPhysician}
                    onChange={(e) =>
                      setDecisionData({ ...decisionData, validatorPhysician: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="validatorCrm">CRM *</Label>
                  <Input
                    id="validatorCrm"
                    value={decisionData.validatorCrm}
                    onChange={(e) => setDecisionData({ ...decisionData, validatorCrm: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="decisionJustification">
                  Justificativa da decisão
                  <span className="text-xs text-muted-foreground ml-2">
                    (obrigatório apenas para negação)
                  </span>
                </Label>
                <Textarea
                  id="decisionJustification"
                  value={decisionData.decisionJustification}
                  onChange={(e) =>
                    setDecisionData({ ...decisionData, decisionJustification: e.target.value })
                  }
                  rows={4}
                  placeholder="Preencha a justificativa apenas se for negar a solicitação"
                />
              </div>

              <div>
                <Label htmlFor="decisionObservation">Observação (opcional)</Label>
                <Textarea
                  id="decisionObservation"
                  value={decisionData.decisionObservation}
                  onChange={(e) =>
                    setDecisionData({ ...decisionData, decisionObservation: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  onClick={() => handleDecision("aprovada")}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleDecision("negada")}
                  disabled={submitting}
                  variant="destructive"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Negar
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleDecision("complemento_solicitado")}
                  disabled={submitting}
                  variant="outline"
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Solicitar Complemento
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleDecision("aprovada_com_observacao")}
                  disabled={submitting}
                  variant="outline"
                  className="border-blue-600 text-blue-700 hover:bg-blue-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar com Obs.
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Laudos Modal */}
        <Dialog open={laudosModalOpen} onOpenChange={setLaudosModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Laudos do Paciente</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {laudos.filter(laudo => laudo.dt_laudo).length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum laudo encontrado</p>
              ) : (
                laudos.filter(laudo => laudo.dt_laudo).map((laudo, index) => {
                  const status = laudo.id_exame_pedido ? laudoStatus[laudo.id_exame_pedido] : undefined;
                  
                  return (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => laudo.id_exame_pedido && openLaudoPdf(laudo.id_exame_pedido)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {laudo.nome_exa_rx || 'Exame não especificado'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Data: {laudo.dt_laudo ? new Date(laudo.dt_laudo).toLocaleDateString('pt-BR') : 'N/A'}
                          </div>
                          {laudo.cd_atendimento && (
                            <div className="text-sm text-gray-500">
                              Atendimento: {laudo.cd_atendimento}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {status === 'loading' && (
                            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                          )}
                          {status === 'success' && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                          {status === 'error' && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Exames Modal */}
        <Dialog open={examesModalOpen} onOpenChange={setExamesModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Exames do Paciente</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg mb-4">
              ⚠️ O visualizador de exames pode demorar até 20 segundos para carregar
            </div>
            <div className="space-y-2">
              {exames.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum exame com visualizador encontrado</p>
              ) : (
                exames.map((exame, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => exame.id_exame_pedido && openExameVisualizador(exame.id_exame_pedido)}
                  >
                    <div className="font-medium text-gray-900">
                      {exame.nome_exa_rx || 'Exame não especificado'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Data: {exame.dt_laudo ? new Date(exame.dt_laudo).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                    {exame.cd_atendimento && (
                      <div className="text-sm text-gray-500">
                        Atendimento: {exame.cd_atendimento}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Diagnostic Modal */}
        <Dialog open={diagnosticModalOpen} onOpenChange={setDiagnosticModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Diagnóstico de Envio de Notificações</DialogTitle>
            </DialogHeader>
            {diagnosticData && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Informações Gerais</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Protocolo:</strong> {diagnosticData.protocol}</p>
                    <p><strong>Decisão:</strong> {diagnosticData.decision}</p>
                    <p><strong>Horário:</strong> {new Date(diagnosticData.timestamp).toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${diagnosticData.botTokenConfigured ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h3 className="font-semibold mb-2">
                    {diagnosticData.botTokenConfigured ? '✓' : '✗'} Configuração do Bot
                  </h3>
                  <p className="text-sm">
                    {diagnosticData.botTokenConfigured 
                      ? 'Token do bot Telegram configurado corretamente' 
                      : 'Token do bot Telegram NÃO está configurado'}
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Enfermeiros</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Total cadastrados:</strong> {diagnosticData.nursesFound}</p>
                    <p><strong>Com Telegram habilitado:</strong> {diagnosticData.nursesWithTelegram}</p>
                    
                    {diagnosticData.nursesSent.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold mb-2">Tentativas de envio:</p>
                        <ul className="space-y-1">
                          {diagnosticData.nursesSent.map((nurse: any, idx: number) => (
                            <li key={idx} className={nurse.success ? 'text-green-700' : 'text-red-700'}>
                              {nurse.success ? '✓' : '✗'} {nurse.name} (chat_id: {nurse.chat_id})
                              {nurse.error && <span className="block ml-4 text-xs">{nurse.error}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Médicos Solicitantes</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Total cadastrados:</strong> {diagnosticData.requestersFound}</p>
                    <p><strong>Com Telegram habilitado:</strong> {diagnosticData.requestersWithTelegram}</p>
                    
                    {diagnosticData.requestersSent.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold mb-2">Tentativas de envio:</p>
                        <ul className="space-y-1">
                          {diagnosticData.requestersSent.map((requester: any, idx: number) => (
                            <li key={idx} className={requester.success ? 'text-green-700' : 'text-red-700'}>
                              {requester.success ? '✓' : '✗'} {requester.name} (chat_id: {requester.chat_id})
                              {requester.error && <span className="block ml-4 text-xs">{requester.error}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {diagnosticData.errors.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-red-900">Erros Encontrados</h3>
                    <ul className="space-y-1 text-sm text-red-700">
                      {diagnosticData.errors.map((error: string, idx: number) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDiagnosticModalOpen(false)}>
                    Fechar
                  </Button>
                  <Button onClick={() => {
                    setDiagnosticModalOpen(false);
                    navigate("/fila");
                  }}>
                    Ir para Fila de Validação
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </PageLayout>
  );
}
