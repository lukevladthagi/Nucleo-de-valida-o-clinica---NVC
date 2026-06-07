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
import { 
  User, 
  AlertTriangle, 
  FileText, 
  Send,
  Sparkles,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Stethoscope,
  TestTube,
  Shield
} from "lucide-react";
import RequestConfirmation from "@/components/RequestConfirmation";
import type { CreatedRequest } from "@/shared/types";

export default function SinglePageRequestForm() {
  const [searchParams] = useSearchParams();
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
    birthDate: "",
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
    infectionSignsOther: "",
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

  const calculateAgeFromBirthDate = (birthDateStr: string) => {
    if (!birthDateStr) return "";
    
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age.toString();
  };

  const handleBirthDateChange = (birthDateStr: string) => {
    const calculatedAge = calculateAgeFromBirthDate(birthDateStr);
    setFormData(prev => ({ 
      ...prev, 
      birthDate: birthDateStr,
      age: calculatedAge
    }));
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
      let birthDate = "";
      if (data.dt_nascimento) {
        const birthDateObj = new Date(data.dt_nascimento);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
          calculatedAge--;
        }
        
        age = calculatedAge.toString();
        
        // Format birth date as YYYY-MM-DD for the date input
        const year = birthDateObj.getFullYear();
        const month = String(birthDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(birthDateObj.getDate()).padStart(2, '0');
        birthDate = `${year}-${month}-${day}`;
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
        birthDate: birthDate || prev.birthDate,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewRequest = () => {
    setSubmitResult(null);
    setFormData({
      patientName: "",
      age: "",
      birthDate: "",
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
      infectionSignsOther: "",
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

  const SectionHeader = ({ icon: Icon, title, subtitle }: any) => (
    <div className="flex items-center gap-4 mb-6">
      <div className="bg-gradient-to-br from-[#1E6BFF] to-[#0B2C5F] p-3 rounded-lg">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-[#0B2C5F]">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </div>
  );

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

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Error Display */}
          {submitError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-900 mb-1">Erro ao enviar solicitação</div>
                    <div className="text-sm text-red-700 whitespace-pre-wrap">{submitError}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 1: Patient Identification */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <SectionHeader 
                icon={User}
                title="Identificação do Paciente"
                subtitle="Dados demográficos e origem do atendimento"
              />

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

                  <div className="grid grid-cols-2 gap-3">
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
                      <Label>Data de nascimento</Label>
                      <Input
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => handleBirthDateChange(e.target.value)}
                      />
                    </div>
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

          {/* Section 2: Clinical Data */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <SectionHeader 
                icon={Stethoscope}
                title="Dados Clínicos"
                subtitle="Quadro clínico atual e hipóteses diagnósticas"
              />

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

          {/* Section 3: Objective Data */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-50 to-white">
            <CardContent className="p-8">
              <SectionHeader 
                icon={TestTube}
                title="Dados Objetivos Disponíveis"
                subtitle="Exames complementares e avaliação"
              />

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>ECG *</Label>
                    <Textarea
                      value={formData.ecg}
                      onChange={(e) => updateField("ecg", e.target.value)}
                      placeholder="Descreva os achados do ECG..."
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
                      placeholder="Resultado da troponina..."
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
                      placeholder="PA, FC, FR, Sat O2, Temperatura..."
                      rows={3}
                      required
                      className="resize-none"
                    />
                  </div>

                  <div>
                    <Label>Ecocardiograma (se houver)</Label>
                    <Textarea
                      value={formData.echocardiogram}
                      onChange={(e) => updateField("echocardiogram", e.target.value)}
                      placeholder="Achados do ecocardiograma..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>

                <div>
                  <Label>Outros Exames (Angiotomografia, teste funcional, etc.)</Label>
                  <Textarea
                    value={formData.otherExams}
                    onChange={(e) => updateField("otherExams", e.target.value)}
                    placeholder="Outros exames realizados..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div>
                  <Label>Exames Laboratoriais Relevantes</Label>
                  <Textarea
                    value={formData.labResults}
                    onChange={(e) => updateField("labResults", e.target.value)}
                    placeholder="Hemograma, função renal, eletrólitos, etc..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Infectious Assessment */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50/50 to-white">
            <CardContent className="p-8">
              <SectionHeader 
                icon={Shield}
                title="Avaliação Infecciosa"
                subtitle="Investigação de quadros infecciosos associados"
              />

              <div className="space-y-6">
                <div>
                  <Label className="mb-4 block">Presença de quadro infeccioso ativo?</Label>
                  <RadioGroup 
                    value={formData.hasActiveInfection} 
                    onValueChange={(value) => updateField("hasActiveInfection", value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="não" id="no-infection" />
                      <Label htmlFor="no-infection" className="cursor-pointer">Não</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="yes-infection" />
                      <Label htmlFor="yes-infection" className="cursor-pointer">Sim</Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.hasActiveInfection === "sim" && (
                  <div>
                    <Label>Descrever foco provável *</Label>
                    <Textarea
                      value={formData.infectiousFocus}
                      onChange={(e) => updateField("infectiousFocus", e.target.value)}
                      placeholder="Descreva o foco infeccioso..."
                      rows={3}
                      required
                      className="resize-none"
                    />
                  </div>
                )}

                <div>
                  <Label className="mb-3 block">Sinais de infecção</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Febre", "Leucocitose", "PCR elevada", "Outros"].map((sign) => (
                      <div key={sign} className="flex items-center space-x-2">
                        <Checkbox
                          id={sign}
                          checked={formData.infectionSigns.includes(sign)}
                          onCheckedChange={() => toggleInfectionSign(sign)}
                        />
                        <Label htmlFor={sign} className="cursor-pointer">{sign}</Label>
                      </div>
                    ))}
                  </div>
                  {formData.infectionSigns.includes("Outros") && (
                    <div className="mt-4">
                      <Label>Descrever outros sinais de infecção</Label>
                      <Textarea
                        value={formData.infectionSignsOther}
                        onChange={(e) => updateField("infectionSignsOther", e.target.value)}
                        rows={3}
                        placeholder="Descreva outros sinais de infecção observados..."
                        className="resize-none"
                      />
                    </div>
                  )}
                </div>


              </div>
            </CardContent>
          </Card>

          {/* Section 5: Admission Justification */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50/50 to-white">
            <CardContent className="p-8">
              <SectionHeader 
                icon={FileText}
                title="Justificativa da Internação"
                subtitle="Fundamentação clínica e plano terapêutico"
              />

              <div className="space-y-6">
                <div>
                  <Label>Justificativa Clínica para Internação *</Label>
                  <Textarea
                    value={formData.admissionJustification}
                    onChange={(e) => updateField("admissionJustification", e.target.value)}
                    placeholder="Por que este paciente necessita internação hospitalar..."
                    rows={4}
                    required
                    className="resize-none"
                  />
                </div>

                <div>
                  <Label>Risco Clínico Atual *</Label>
                  <Select 
                    value={formData.clinicalRisk} 
                    onValueChange={(value) => updateField("clinicalRisk", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o risco clínico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alto">Alto</SelectItem>
                      <SelectItem value="moderado">Moderado</SelectItem>
                      <SelectItem value="baixo">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Justificativa do Risco</Label>
                  <Textarea
                    value={formData.riskJustification}
                    onChange={(e) => updateField("riskJustification", e.target.value)}
                    placeholder="Fundamente a classificação de risco..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div>
                  <Label>Plano Intra-Hospitalar Proposto *</Label>
                  <Textarea
                    value={formData.inpatientPlan}
                    onChange={(e) => updateField("inpatientPlan", e.target.value)}
                    placeholder="Qual o plano terapêutico/diagnóstico durante a internação..."
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
                    placeholder="Qual o desfecho esperado com a internação..."
                    rows={3}
                    required
                    className="resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Priority Classification */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <SectionHeader 
                icon={AlertTriangle}
                title="Classificação de Prioridade"
                subtitle="Definição do grau de urgência da internação"
              />

              <div className="space-y-6">
                {suggestedPriority && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900 mb-1">Sugestão Inteligente</div>
                        <div className="text-sm text-blue-700">
                          Com base nos dados clínicos, sugerimos prioridade:{" "}
                          <span className="font-bold uppercase">{suggestedPriority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

          {/* Section 7: Term and Signature */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="agree-terms"
                      checked={formData.agreeTerms}
                      onCheckedChange={(checked) => updateField("agreeTerms", checked)}
                      required
                    />
                    <Label htmlFor="agree-terms" className="text-sm leading-relaxed cursor-pointer">
                      Declaro que a solicitação de internação está baseada em critérios clínicos, 
                      evidência disponível e necessidade assistencial do paciente, não havendo 
                      motivação por conveniência não assistencial, e que foi avaliada a presença 
                      de condição infecciosa associada.
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Nome do Médico Solicitante *</Label>
                    <Input
                      value={formData.requestingPhysician}
                      onChange={(e) => updateField("requestingPhysician", e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>

                  <div>
                    <Label>CRM do Médico Solicitante *</Label>
                    <Input
                      value={formData.crm}
                      onChange={(e) => updateField("crm", e.target.value)}
                      placeholder="CRM"
                      required
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="min-w-[300px] bg-gradient-to-r from-[#1E6BFF] to-[#0B2C5F] hover:from-[#0B2C5F] hover:to-[#1E6BFF] text-white shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enviando solicitação...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Enviar Solicitação
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
