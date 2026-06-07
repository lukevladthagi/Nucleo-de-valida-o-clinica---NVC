import z from "zod";

// Request form schema
export const RequestFormSchema = z.object({
  // Section 1
  medicalRecordNumber: z.string().optional(),
  patientName: z.string().min(1, "Nome do paciente é obrigatório"),
  age: z.string().min(1, "Idade é obrigatória"),
  sex: z.enum(["masculino", "feminino"], { required_error: "Sexo é obrigatório" }),
  insurance: z.string().min(1, "Convênio é obrigatório"),
  attendingPhysician: z.string().min(1, "Médico assistente é obrigatório"),
  mvSoulNumber: z.string().min(1, "Número do atendimento MVSOUL é obrigatório"),
  origin: z.enum(["ambulatorio", "emergencia", "eletivo"], { required_error: "Origem é obrigatória" }),
  
  // Section 2
  clinicalPresentation: z.string().min(1, "Quadro clínico atual é obrigatório"),
  symptomDuration: z.string().optional(),
  primaryDiagnosis: z.string().min(1, "Hipótese diagnóstica principal é obrigatória"),
  differentialDiagnosis: z.string().optional(),
  
  // Section 3
  ecg: z.string().min(1, "ECG é obrigatório"),
  troponin: z.string().optional(),
  vitalSigns: z.string().min(1, "Sinais vitais são obrigatórios"),
  echocardiogram: z.string().optional(),
  otherExams: z.string().optional(),
  labResults: z.string().optional(),
  
  // Section 4
  hasActiveInfection: z.enum(["sim", "nao"], { required_error: "Campo obrigatório" }),
  infectiousFocus: z.string().optional(),
  infectionSigns: z.array(z.string()),
  infectionSignsOther: z.string().optional(),
  cardiacJustification: z.string().optional(),
  
  // Section 5
  admissionJustification: z.string().min(1, "Justificativa clínica é obrigatória"),
  clinicalRisk: z.enum(["alto", "moderado", "baixo"], { required_error: "Risco clínico é obrigatório" }),
  riskJustification: z.string().optional(),
  inpatientPlan: z.string().min(1, "Plano intra-hospitalar é obrigatório"),
  expectedBenefit: z.string().min(1, "Benefício esperado é obrigatório"),
  
  // Section 6
  priorityClassification: z.enum(["imediata", "urgente", "eletiva"], { required_error: "Prioridade é obrigatória" }),
  selectedValidatorId: z.string().optional(), // Optional - system sends to all validators
  
  // Final
  agreeTerms: z.literal(true, { required_error: "Você deve aceitar o termo de responsabilidade" }),
  requestingPhysician: z.string().min(1, "Nome do médico solicitante é obrigatório"),
  crm: z.string().min(1, "CRM é obrigatório"),
});

export type RequestFormData = z.infer<typeof RequestFormSchema>;

// API response for created request
export const CreatedRequestSchema = z.object({
  success: z.boolean(),
  protocol: z.string(),
  status: z.string(),
  priority: z.string(),
  slaMinutes: z.number(),
  slaDeadline: z.string(),
});

export type CreatedRequest = z.infer<typeof CreatedRequestSchema>;

// Request status types
export type RequestStatus = 
  | "rascunho"
  | "enviada" 
  | "aguardando_validacao"
  | "aprovada"
  | "negada"
  | "complemento_solicitado"
  | "sla_vencido"
  | "cancelada";

// Validator decision schema
export const ValidatorDecisionSchema = z.object({
  decision: z.enum(["aprovada", "negada", "complemento_solicitado", "aprovada_com_observacao"]),
  validatorPhysician: z.string().min(1, "Nome do médico validador é obrigatório"),
  validatorCrm: z.string().min(1, "CRM é obrigatório"),
  decisionJustification: z.string().optional(),
  decisionObservation: z.string().optional(),
});

export type ValidatorDecision = z.infer<typeof ValidatorDecisionSchema>;
