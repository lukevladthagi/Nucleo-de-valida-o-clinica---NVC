"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "@/lib/router-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Send,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Clock
} from "lucide-react";
import RequestConfirmation from "@/components/RequestConfirmation";
import type { CreatedRequest } from "@/shared/types";

interface Step {
  id: number;
  title: string;
  icon: any;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, title: "Identificação", icon: User, description: "Dados do paciente" },
  { id: 2, title: "Dados Clínicos", icon: FileText, description: "Quadro clínico atual" },
  { id: 3, title: "Critérios Assistenciais", icon: Activity, description: "Exames e avaliação" },
  { id: 4, title: "Prioridade", icon: AlertTriangle, description: "Classificação de risco" },
  { id: 5, title: "Revisão", icon: CheckCircle2, description: "Validação final" }
];

export default function PremiumRequestForm() {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<CreatedRequest | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFetchingPatient, setIsFetchingPatient] = useState(false);
  const [fetchPatientError, setFetchPatientError] = useState<string | null>(null);
  const [fetchPatientSuccess, setFetchPatientSuccess] = useState<string | null>(null);
  const [suggestedPriority, setSuggestedPriority] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    patientName: "",
    age: "",
    sex: "",
    insurance: "",
    attendingPhysician: "",
    mvSoulNumber: searchParams.get("atendimento") || "",
    origin: "",
    clinicalPresentation: "",
    clinicalPresentationDate: "",
    symptomDuration: "",
    primaryDiagnosis: "",
    differentialDiagnosis: "",
    ecg: "",
    troponin: "",
    vitalSigns: "",
    echocardiogram: "",
    otherExams: "",
    labResults: "",
    hasActiveInfection: "",
    infectiousFocus: "",
    infectionSigns: [] as string[],
    isNonCardiacInfection: "",
    cardiacJustification: "",
    admissionJustification: "",
    clinicalRisk: "",
    riskJustification: "",
    inpatientPlan: "",
    expectedBenefit: "",
    priorityClassification: "",
    selectedValidatorId: "",
    agreeTerms: false,
    requestingPhysician: "",
    crm: "",
  });

  useEffect(() => {
    // Auto-calculate suggested priority based on clinical data
    const calculatePriority = () => {
      const hasTroponinPositive = formData.troponin.toLowerCase().includes("positiv") || 
                                   formData.troponin.toLowerCase().includes("+");
      const hasChestPain = formData.clinicalPresentation.toLowerCase().includes("dor torácica") ||
                           formData.clinicalPresentation.toLowerCase().includes("dor no peito");
      const hasEcgAbnormal = formData.ecg.toLowerCase().includes("alterado") ||
                             formData.ecg.toLowerCase().includes("anormal");
      const isHighRisk = formData.clinicalRisk === "alto";

      if ((hasTroponinPositive && hasChestPain) || (hasEcgAbnormal && hasChestPain) || isHighRisk) {
        setSuggestedPriority("imediata");
      } else if (formData.clinicalRisk === "moderado") {
        setSuggestedPriority("urgente");
      } else if (formData.clinicalRisk === "baixo") {
        setSuggestedPriority("eletiva");
      }
    };

    calculatePriority();
  }, [formData.troponin, formData.clinicalPresentation, formData.ecg, formData.clinicalRisk]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInfectionSign = (sign: string) => {
    setFormData(prev => ({
      ...prev,
      infectionSigns: prev.infectionSigns.includes(sign)
        ? prev.infectionSigns.filter(s => s !== sign)
        : [...prev.infectionSigns, sign]
    }));
  };

  const fetchPatientDataManual = async () => {
    const atendimento = formData.mvSoulNumber.trim();
    
    if (!atendimento) {
      setFetchPatientError("Digite o número do atendimento");
      return;
    }

    setIsFetchingPatient(true);
    setFetchPatientError(null);
    setFetchPatientSuccess(null);
    
    try {
      const response = await fetch(`/api/mvsoul/patient/${atendimento}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Erro ao buscar dados do paciente";
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Log diagnostic info
      console.log("=== MVSOUL API Response ===");
      console.log("Full data:", data);
      console.log("ds_evolucao:", data.ds_evolucao);
      console.log("_diagnostic:", data._diagnostic);
      
      let age = "";
      if (data.dt_nascimento) {
        const birthDate = new Date(data.dt_nascimento);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        
        age = calculatedAge.toString();
      }
      
      let sex = "";
      if (data.tp_sexo) {
        const sexLower = data.tp_sexo.toLowerCase();
        if (sexLower === "m") {
          sex = "masculino";
        } else if (sexLower === "f" || sexLower === "s") {
          sex = "feminino";
        }
      }
      
      setFormData(prev => ({
        ...prev,
        patientName: data.nm_paciente || prev.patientName,
        age: age || prev.age,
        sex: sex || prev.sex,
        insurance: data.nm_convenio || prev.insurance,
        attendingPhysician: data.nm_prestador_evolucao || data.nm_prestador || prev.attendingPhysician,
        clinicalPresentation: data.ds_evolucao || prev.clinicalPresentation,
        clinicalPresentationDate: data.dt_pre_med || prev.clinicalPresentationDate,
        vitalSigns: data.vital_signs || data.vitalSigns || prev.vitalSigns,
        labResults: data.lab_results || data.labResults || prev.labResults,
      }));
      
      setFetchPatientSuccess("Dados do paciente carregados com sucesso!");
      setTimeout(() => setFetchPatientSuccess(null), 3000);
      
    } catch (error) {
      console.error("Error fetching patient data:", error);
      
      let errorMessage = "Erro ao buscar dados do paciente";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        errorMessage = "Não foi possível conectar com a API do MVSOUL.";
      }
      
      setFetchPatientError(errorMessage);
    } finally {
      setIsFetchingPatient(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Erro desconhecido";
        
        try {
          const errorData = JSON.parse(errorText);
          
          if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessage = errorData.errors.map((err: any) => 
              `${err.path ? err.path.join('.') + ': ' : ''}${err.message}`
            ).join('\n');
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setSubmitResult(result);
      
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError(error instanceof Error ? error.message : "Erro ao enviar solicitação");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewRequest = () => {
    setSubmitResult(null);
    setCurrentStep(1);
    setFormData({
      patientName: "",
      age: "",
      sex: "",
      insurance: "",
      attendingPhysician: "",
      mvSoulNumber: "",
      origin: "",
      clinicalPresentation: "",
      clinicalPresentationDate: "",
      symptomDuration: "",
      primaryDiagnosis: "",
      differentialDiagnosis: "",
      ecg: "",
      troponin: "",
      vitalSigns: "",
      echocardiogram: "",
      otherExams: "",
      labResults: "",
      hasActiveInfection: "",
      infectiousFocus: "",
      infectionSigns: [] as string[],
      isNonCardiacInfection: "",
      cardiacJustification: "",
      admissionJustification: "",
      clinicalRisk: "",
      riskJustification: "",
      inpatientPlan: "",
      expectedBenefit: "",
      priorityClassification: "",
      selectedValidatorId: "",
      agreeTerms: false,
      requestingPhysician: "",
      crm: "",
    });
  };

  if (submitResult) {
    return <RequestConfirmation result={submitResult} onNewRequest={handleNewRequest} />;
  }

  const PriorityBadge = ({ priority, isSelected, onClick }: any) => {
    const configs: Record<string, any> = {
      imediata: {
        emoji: "🔴",
        label: "Imediata",
        color: "bg-red-500",
        textColor: "text-red-700",
        borderColor: "border-red-500",
        glowColor: "shadow-red-500/50",
        description: "Fast-track - 10 minutos"
      },
      urgente: {
        emoji: "🟠",
        label: "Urgente",
        color: "bg-orange-500",
        textColor: "text-orange-700",
        borderColor: "border-orange-500",
        glowColor: "shadow-orange-500/50",
        description: "Validação rápida - 15 minutos"
      },
      eletiva: {
        emoji: "🔵",
        label: "Eletiva",
        color: "bg-blue-500",
        textColor: "text-blue-700",
        borderColor: "border-blue-500",
        glowColor: "shadow-blue-500/50",
        description: "Avaliação programada - 30 minutos"
      }
    };

    const config = configs[priority];

    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          relative p-6 rounded-xl border-2 transition-all duration-300
          ${isSelected 
            ? `${config.borderColor} ${config.color} bg-opacity-10 shadow-lg ${config.glowColor}` 
            : 'border-border bg-card hover:border-accent/50 hover:shadow-md'
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">{config.emoji}</span>
          <div className="text-center">
            <div className={`font-bold text-lg ${isSelected ? config.textColor : 'text-foreground'}`}>
              {config.label}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {config.description}
            </div>
          </div>
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className={`h-5 w-5 ${config.textColor}`} />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[#0B2C5F] via-[#1E6BFF] to-[#0B2C5F] text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <img 
                src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png" 
                alt="Núcleo de Validação Clínica"
                className="h-16 object-contain"
              />
            </div>
            <div className="flex items-center gap-3 text-blue-100">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Protocolo Digital de Pré-Internação</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(step.id)}
                    className={`
                      flex flex-col items-center gap-2 transition-all duration-300
                      ${isActive || isCompleted ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                    `}
                    disabled={currentStep < step.id}
                  >
                    <div className={`
                      flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                      ${isActive 
                        ? 'bg-[#1E6BFF] border-[#1E6BFF] text-white shadow-lg shadow-blue-500/50' 
                        : isCompleted 
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-border text-muted-foreground'
                      }
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="text-center hidden md:block">
                      <div className={`text-sm font-semibold ${isActive ? 'text-[#0B2C5F]' : 'text-muted-foreground'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`
                      flex-1 h-0.5 mx-4 transition-all duration-300
                      ${currentStep > step.id ? 'bg-green-500' : 'bg-border'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <form onSubmit={(e) => { e.preventDefault(); }}>
          
          {/* Step 1: Patient Identification */}
          {currentStep === 1 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#0B2C5F] mb-2">Identificação do Paciente</h2>
                  <p className="text-muted-foreground">Dados demográficos e origem do atendimento</p>
                </div>

                <div className="space-y-6">
                  {/* MVSOUL Number with Auto-fetch */}
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <Label className="text-sm font-semibold text-[#0B2C5F] mb-3 block">
                      Número do Atendimento MVSOUL
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        value={formData.mvSoulNumber}
                        onChange={(e) => updateField("mvSoulNumber", e.target.value)}
                        placeholder="Digite o número do atendimento"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={fetchPatientDataManual}
                        disabled={isFetchingPatient || !formData.mvSoulNumber}
                        variant="secondary"
                        className="min-w-[140px]"
                      >
                        {isFetchingPatient ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Buscar Dados
                          </>
                        )}
                      </Button>
                    </div>
                    {fetchPatientSuccess && (
                      <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {fetchPatientSuccess}
                      </p>
                    )}
                    {fetchPatientError && (
                      <p className="text-sm text-red-600 mt-2">{fetchPatientError}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Nome do Paciente *</Label>
                      <Input
                        value={formData.patientName}
                        onChange={(e) => updateField("patientName", e.target.value)}
                        placeholder="Nome completo"
                        required
                      />
                    </div>

                    <div>
                      <Label>Idade *</Label>
                      <Input
                        type="number"
                        value={formData.age}
                        onChange={(e) => updateField("age", e.target.value)}
                        placeholder="Anos"
                        required
                      />
                    </div>

                    <div>
                      <Label>Sexo *</Label>
                      <Select value={formData.sex} onValueChange={(value) => updateField("sex", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Convênio *</Label>
                      <Input
                        value={formData.insurance}
                        onChange={(e) => updateField("insurance", e.target.value)}
                        placeholder="Nome do convênio"
                        required
                      />
                    </div>

                    <div>
                      <Label>Médico Assistente *</Label>
                      <Input
                        value={formData.attendingPhysician}
                        onChange={(e) => updateField("attendingPhysician", e.target.value)}
                        placeholder="Nome do médico"
                        required
                      />
                    </div>

                    <div>
                      <Label>Origem *</Label>
                      <Select value={formData.origin} onValueChange={(value) => updateField("origin", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ambulatorio">Ambulatório</SelectItem>
                          <SelectItem value="emergencia">Emergência</SelectItem>
                          <SelectItem value="eletivo">Eletivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Clinical Data */}
          {currentStep === 2 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#0B2C5F] mb-2">Dados Clínicos</h2>
                  <p className="text-muted-foreground">Quadro clínico atual e hipóteses diagnósticas</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <Label>Quadro Clínico Atual *</Label>
                    <Textarea
                      value={formData.clinicalPresentation}
                      onChange={(e) => updateField("clinicalPresentation", e.target.value)}
                      placeholder="Descreva o quadro clínico atual do paciente..."
                      rows={4}
                      required
                      className="resize-none"
                    />
                    {formData.clinicalPresentationDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Data da evolução: {new Date(formData.clinicalPresentationDate).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Tempo de Evolução dos Sintomas</Label>
                    <Input
                      value={formData.symptomDuration}
                      onChange={(e) => updateField("symptomDuration", e.target.value)}
                      placeholder="Ex: 3 horas, 2 dias..."
                    />
                  </div>

                  <div>
                    <Label>Hipótese Diagnóstica Principal *</Label>
                    <Textarea
                      value={formData.primaryDiagnosis}
                      onChange={(e) => updateField("primaryDiagnosis", e.target.value)}
                      placeholder="Principal suspeita diagnóstica..."
                      rows={3}
                      required
                      className="resize-none"
                    />
                  </div>

                  <div>
                    <Label>Diagnósticos Diferenciais Relevantes</Label>
                    <Textarea
                      value={formData.differentialDiagnosis}
                      onChange={(e) => updateField("differentialDiagnosis", e.target.value)}
                      placeholder="Outras possibilidades diagnósticas..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Clinical Assessment */}
          {currentStep === 3 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#0B2C5F] mb-2">Critérios Assistenciais</h2>
                  <p className="text-muted-foreground">Exames objetivos e avaliação infecciosa</p>
                </div>

                <div className="space-y-8">
                  {/* Exames Objetivos */}
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="font-semibold text-[#0B2C5F] mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Exames Objetivos Disponíveis
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>ECG *</Label>
                          <Textarea
                            value={formData.ecg}
                            onChange={(e) => updateField("ecg", e.target.value)}
                            placeholder="Resultado do ECG..."
                            rows={3}
                            required
                            className="resize-none"
                          />
                        </div>

                        <div>
                          <Label>Troponina *</Label>
                          <Textarea
                            value={formData.troponin}
                            onChange={(e) => updateField("troponin", e.target.value)}
                            placeholder="Valor e resultado..."
                            rows={3}
                            required
                            className="resize-none"
                          />
                        </div>

                        <div>
                          <Label>Sinais Vitais *</Label>
                          <Textarea
                            value={formData.vitalSigns}
                            onChange={(e) => updateField("vitalSigns", e.target.value)}
                            placeholder="PA, FC, SpO2, Tax..."
                            rows={3}
                            required
                            className="resize-none"
                          />
                        </div>

                        <div>
                          <Label>Ecocardiograma</Label>
                          <Textarea
                            value={formData.echocardiogram}
                            onChange={(e) => updateField("echocardiogram", e.target.value)}
                            placeholder="Resultado, se disponível..."
                            rows={3}
                            className="resize-none"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Outros Exames (Angiotomografia, Teste Funcional, etc.)</Label>
                        <Textarea
                          value={formData.otherExams}
                          onChange={(e) => updateField("otherExams", e.target.value)}
                          placeholder="Outros exames relevantes..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      <div>
                        <Label>Exames Laboratoriais Relevantes</Label>
                        <Textarea
                          value={formData.labResults}
                          onChange={(e) => updateField("labResults", e.target.value)}
                          placeholder="Hemograma, função renal, eletrólitos..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Avaliação Infecciosa */}
                  <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                    <h3 className="font-semibold text-[#0B2C5F] mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Avaliação Infecciosa
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <Label>Presença de Quadro Infeccioso Ativo?</Label>
                        <RadioGroup
                          value={formData.hasActiveInfection}
                          onValueChange={(value) => updateField("hasActiveInfection", value)}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="nao" id="infection-no" />
                            <Label htmlFor="infection-no" className="font-normal cursor-pointer">Não</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sim" id="infection-yes" />
                            <Label htmlFor="infection-yes" className="font-normal cursor-pointer">Sim</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {formData.hasActiveInfection === "sim" && (
                        <>
                          <div>
                            <Label>Descrever Foco Provável *</Label>
                            <Textarea
                              value={formData.infectiousFocus}
                              onChange={(e) => updateField("infectiousFocus", e.target.value)}
                              placeholder="Descreva o foco infeccioso..."
                              rows={3}
                              required
                              className="resize-none"
                            />
                          </div>

                          <div>
                            <Label>Sinais de Infecção</Label>
                            <div className="space-y-2 mt-2">
                              {["Febre", "Leucocitose", "PCR elevada", "Outros"].map((sign) => (
                                <div key={sign} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`sign-${sign}`}
                                    checked={formData.infectionSigns.includes(sign)}
                                    onCheckedChange={() => toggleInfectionSign(sign)}
                                  />
                                  <Label htmlFor={`sign-${sign}`} className="font-normal cursor-pointer">
                                    {sign}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>


                        </>
                      )}
                    </div>
                  </div>

                  {/* Justificativa da Internação */}
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="font-semibold text-[#0B2C5F] mb-4">Justificativa da Internação</h3>

                    <div className="space-y-4">
                      <div>
                        <Label>Justificativa Clínica para Internação *</Label>
                        <Textarea
                          value={formData.admissionJustification}
                          onChange={(e) => updateField("admissionJustification", e.target.value)}
                          placeholder="Por que este paciente precisa de internação..."
                          rows={4}
                          required
                          className="resize-none"
                        />
                      </div>

                      <div>
                        <Label>Risco Clínico Atual *</Label>
                        <RadioGroup
                          value={formData.clinicalRisk}
                          onValueChange={(value) => updateField("clinicalRisk", value)}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="alto" id="risk-high" />
                            <Label htmlFor="risk-high" className="font-normal cursor-pointer">Alto</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="moderado" id="risk-moderate" />
                            <Label htmlFor="risk-moderate" className="font-normal cursor-pointer">Moderado</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="baixo" id="risk-low" />
                            <Label htmlFor="risk-low" className="font-normal cursor-pointer">Baixo</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div>
                        <Label>Justificativa do Risco</Label>
                        <Textarea
                          value={formData.riskJustification}
                          onChange={(e) => updateField("riskJustification", e.target.value)}
                          placeholder="Justifique a classificação de risco..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      <div>
                        <Label>Plano Intra-Hospitalar Proposto *</Label>
                        <Textarea
                          value={formData.inpatientPlan}
                          onChange={(e) => updateField("inpatientPlan", e.target.value)}
                          placeholder="O que será feito durante a internação..."
                          rows={4}
                          required
                          className="resize-none"
                        />
                      </div>

                      <div>
                        <Label>Benefício Esperado com a Internação *</Label>
                        <Textarea
                          value={formData.expectedBenefit}
                          onChange={(e) => updateField("expectedBenefit", e.target.value)}
                          placeholder="Qual o benefício esperado..."
                          rows={3}
                          required
                          className="resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Priority Classification */}
          {currentStep === 4 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#0B2C5F] mb-2">Classificação de Prioridade</h2>
                  <p className="text-muted-foreground">Defina a urgência assistencial do caso</p>
                </div>

                {suggestedPriority && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="bg-[#1E6BFF] p-3 rounded-lg">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-[#0B2C5F] mb-1">Sugestão Inteligente de Prioridade</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Baseado nos dados clínicos informados, o sistema sugere:
                        </p>
                        <Badge className={`
                          text-sm px-4 py-2
                          ${suggestedPriority === 'imediata' ? 'bg-red-500' : ''}
                          ${suggestedPriority === 'urgente' ? 'bg-orange-500' : ''}
                          ${suggestedPriority === 'eletiva' ? 'bg-blue-500' : ''}
                        `}>
                          {suggestedPriority === 'imediata' && '🔴 Prioridade Imediata'}
                          {suggestedPriority === 'urgente' && '🟠 Prioridade Urgente'}
                          {suggestedPriority === 'eletiva' && '🔵 Prioridade Eletiva'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <Label className="text-base">Selecione a Classificação de Prioridade *</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <PriorityBadge
                      priority="imediata"
                      isSelected={formData.priorityClassification === "imediata"}
                      onClick={() => updateField("priorityClassification", "imediata")}
                    />
                    <PriorityBadge
                      priority="urgente"
                      isSelected={formData.priorityClassification === "urgente"}
                      onClick={() => updateField("priorityClassification", "urgente")}
                    />
                    <PriorityBadge
                      priority="eletiva"
                      isSelected={formData.priorityClassification === "eletiva"}
                      onClick={() => updateField("priorityClassification", "eletiva")}
                    />
                  </div>


                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review and Submit */}
          {currentStep === 5 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-[#0B2C5F] mb-2">Revisão e Envio</h2>
                  <p className="text-muted-foreground">Verifique os dados e confirme o envio</p>
                </div>

                <div className="space-y-6">
                  {/* Summary sections */}
                  <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                    <div>
                      <h3 className="font-semibold text-[#0B2C5F] mb-2">Paciente</h3>
                      <p className="text-sm">{formData.patientName}, {formData.age} anos, {formData.sex}</p>
                      <p className="text-sm text-muted-foreground">Atendimento: {formData.mvSoulNumber} | Convênio: {formData.insurance}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-[#0B2C5F] mb-2">Quadro Clínico</h3>
                      <p className="text-sm">{formData.clinicalPresentation}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>Diagnóstico:</strong> {formData.primaryDiagnosis}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-[#0B2C5F] mb-2">Prioridade</h3>
                      <Badge className={`
                        ${formData.priorityClassification === 'imediata' ? 'bg-red-500' : ''}
                        ${formData.priorityClassification === 'urgente' ? 'bg-orange-500' : ''}
                        ${formData.priorityClassification === 'eletiva' ? 'bg-blue-500' : ''}
                      `}>
                        {formData.priorityClassification === 'imediata' && '🔴 Imediata'}
                        {formData.priorityClassification === 'urgente' && '🟠 Urgente'}
                        {formData.priorityClassification === 'eletiva' && '🔵 Eletiva'}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Risco clínico: {formData.clinicalRisk}
                      </p>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => updateField("agreeTerms", checked)}
                      />
                      <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                        Declaro que a solicitação de internação está baseada em critérios clínicos, evidência disponível 
                        e necessidade assistencial do paciente, não havendo motivação por conveniência não assistencial, 
                        e que foi avaliada a presença de condição infecciosa associada.
                      </Label>
                    </div>
                  </div>

                  {/* Physician signature */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Médico Solicitante *</Label>
                      <Input
                        value={formData.requestingPhysician}
                        onChange={(e) => updateField("requestingPhysician", e.target.value)}
                        placeholder="Nome completo"
                        required
                      />
                    </div>

                    <div>
                      <Label>CRM *</Label>
                      <Input
                        value={formData.crm}
                        onChange={(e) => updateField("crm", e.target.value)}
                        placeholder="Número do CRM"
                        required
                      />
                    </div>
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-600 whitespace-pre-line">{submitError}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="min-w-[120px]"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>

            <div className="text-sm text-muted-foreground">
              Etapa {currentStep} de {STEPS.length}
            </div>

            {currentStep < STEPS.length ? (
              <Button
                type="button"
                onClick={nextStep}
                className="min-w-[120px] bg-[#1E6BFF] hover:bg-[#0B2C5F]"
              >
                Próxima
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.agreeTerms}
                className="min-w-[160px] bg-gradient-to-r from-[#0B2C5F] to-[#1E6BFF] hover:opacity-90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
