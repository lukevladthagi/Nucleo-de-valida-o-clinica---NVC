'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from '@/lib/router-shim';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
  XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequestConfirmation from '@/components/RequestConfirmation';
import type { CreatedRequest } from '@/shared/types';

export default function RequestForm() {
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<CreatedRequest | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFetchingPatient, setIsFetchingPatient] = useState(false);
  const [fetchPatientError, setFetchPatientError] = useState<string | null>(null);
  const [fetchPatientSuccess, setFetchPatientSuccess] = useState<string | null>(null);
  const [patientCode, setPatientCode] = useState<string | null>(null);

  // Laudos modal state
  const [laudosModalOpen, setLaudosModalOpen] = useState(false);
  const [laudos, setLaudos] = useState<any[]>([]);
  const [loadingLaudos, setLoadingLaudos] = useState(false);
  const [laudoStatus, setLaudoStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>(
    {}
  );

  // Exames modal state
  const [examesModalOpen, setExamesModalOpen] = useState(false);
  const [exames, setExames] = useState<any[]>([]);
  const [loadingExames, setLoadingExames] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [formData, setFormData] = useState({
    // Section 1
    medicalRecordNumber: '',
    patientName: '',
    age: '',
    birthDate: '',
    sex: '',
    insurance: '',
    attendingPhysician: '',
    mvSoulNumber: searchParams.get('atendimento') || '',
    origin: '',

    // Section 2
    clinicalPresentation: '',
    clinicalPresentationDate: '',
    symptomDuration: '',
    primaryDiagnosis: '',
    differentialDiagnosis: '',

    // Section 3
    ecg: '',
    troponin: '',
    vitalSigns: '',
    echocardiogram: '',
    otherExams: '',
    labResults: '',

    // Section 4
    hasActiveInfection: '',
    infectiousFocus: '',
    infectionSigns: [] as string[],
    infectionSignsOther: '',
    cardiacJustification: '',

    // Section 5
    admissionJustification: '',
    clinicalRisk: '',
    riskJustification: '',
    inpatientPlan: '',
    expectedBenefit: '',

    // Section 6
    priorityClassification: '',

    // Final
    agreeTerms: false,
    requestingPhysician: '',
    crm: '',
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateAgeFromBirthDate = (birthDateStr: string) => {
    if (!birthDateStr) return '';

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
    setFormData((prev) => ({
      ...prev,
      birthDate: birthDateStr,
      age: calculatedAge,
    }));
  };

  const toggleInfectionSign = (sign: string) => {
    setFormData((prev) => ({
      ...prev,
      infectionSigns: prev.infectionSigns.includes(sign)
        ? prev.infectionSigns.filter((s) => s !== sign)
        : [...prev.infectionSigns, sign],
    }));
  };

  const fetchPatientDataManual = async () => {
    const atendimento = formData.mvSoulNumber.trim();

    if (!atendimento) {
      setFetchPatientError('Digite o número do atendimento');
      return;
    }

    setIsFetchingPatient(true);
    setFetchPatientError(null);
    setFetchPatientSuccess(null);

    try {
      const response = await fetch(`/api/mvsoul/patient/${atendimento}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Erro ao buscar dados do paciente';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Store patient code for laudos/exames
      if (data.cd_paciente) {
        setPatientCode(data.cd_paciente);
      }

      // Log diagnostic info
      console.log('=== MVSOUL API Response ===');
      console.log('Full data:', data);
      console.log('ds_evolucao:', data.ds_evolucao);
      console.log('_diagnostic:', data._diagnostic);

      // Calculate age from birth date
      let age = '';
      let birthDate = '';
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

      // Map sex from API (s/m) to form values (masculino/feminino)
      let sex = '';
      if (data.tp_sexo) {
        const sexLower = data.tp_sexo.toLowerCase();
        if (sexLower === 'm') {
          sex = 'masculino';
        } else if (sexLower === 'f' || sexLower === 's') {
          sex = 'feminino';
        }
      }

      // Update form fields with patient data
      setFormData((prev) => ({
        ...prev,
        medicalRecordNumber: data.cd_paciente ? String(data.cd_paciente) : prev.medicalRecordNumber,
        patientName: data.nm_paciente || prev.patientName,
        age: age || prev.age,
        birthDate: birthDate || prev.birthDate,
        sex: sex || prev.sex,
        insurance: data.nm_convenio || prev.insurance,
        attendingPhysician:
          data.nm_prestador_evolucao || data.nm_prestador || prev.attendingPhysician,
        clinicalPresentation: data.ds_evolucao || prev.clinicalPresentation,
        clinicalPresentationDate: data.dt_pre_med || prev.clinicalPresentationDate,
      }));

      setFetchPatientSuccess('Dados do paciente carregados com sucesso!');
      setTimeout(() => setFetchPatientSuccess(null), 3000);
    } catch (error) {
      console.error('Error fetching patient data:', error);

      let errorMessage = 'Erro ao buscar dados do paciente';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = String(error);
      }

      // Handle network errors specifically
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage =
          'Não foi possível conectar com a API do MVSOUL. Verifique sua conexão de internet ou tente novamente mais tarde.';
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

    // Client-side validation for required fields
    const requiredFields = [
      { field: 'medicalRecordNumber', label: 'Número do prontuário' },
      { field: 'sex', label: 'Sexo' },
      { field: 'origin', label: 'Origem' },
      { field: 'patientName', label: 'Nome do paciente' },
      { field: 'age', label: 'Idade' },
      { field: 'insurance', label: 'Convênio' },
      { field: 'attendingPhysician', label: 'Médico assistente' },
      { field: 'mvSoulNumber', label: 'Número do atendimento MVSOUL' },
      { field: 'clinicalPresentation', label: 'Quadro clínico atual' },
      { field: 'primaryDiagnosis', label: 'Hipótese diagnóstica principal' },
      { field: 'ecg', label: 'ECG' },
      { field: 'vitalSigns', label: 'Sinais vitais' },
      { field: 'hasActiveInfection', label: 'Presença de quadro infeccioso ativo' },
      { field: 'admissionJustification', label: 'Justificativa clínica para internação' },
      { field: 'clinicalRisk', label: 'Risco clínico atual' },
      { field: 'inpatientPlan', label: 'Plano intra-hospitalar proposto' },
      { field: 'expectedBenefit', label: 'Benefício esperado' },
      { field: 'priorityClassification', label: 'Classificação de prioridade' },
      { field: 'requestingPhysician', label: 'Nome do médico solicitante' },
      { field: 'crm', label: 'CRM' },
    ];

    const missingFields = requiredFields.filter(({ field }) => {
      const value = formData[field as keyof typeof formData];
      return !value || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      setSubmitError(
        `Por favor, preencha os seguintes campos obrigatórios:\n${missingFields.map((f) => `- ${f.label}`).join('\n')}`
      );
      setIsSubmitting(false);
      return;
    }

    if (!formData.agreeTerms) {
      setSubmitError(
        'Você deve concordar com o termo de responsabilidade para enviar a solicitação.'
      );
      setIsSubmitting(false);
      return;
    }

    // Conditional validations
    if (formData.hasActiveInfection === 'sim' && !formData.infectiousFocus.trim()) {
      setSubmitError('Por favor, descreva o foco infeccioso provável.');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('=== ENVIANDO SOLICITAÇÃO ===');
      console.log('Form data completo:', formData);
      console.log('Timestamp:', new Date().toISOString());

      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        let errorMessage = 'Erro desconhecido';

        try {
          const errorData = JSON.parse(errorText);
          console.log('Parsed error data:', errorData);

          // Handle Zod validation errors
          if (errorData.error?.issues) {
            const issues = errorData.error.issues as Array<{ path: string[]; message: string }>;
            errorMessage =
              'Erros de validação:\n' +
              issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
          } else if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch {
          errorMessage = errorText || `Erro ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('=== RESPOSTA DE SUCESSO ===');
      console.log('Resultado completo:', JSON.stringify(result, null, 2));
      console.log('Protocolo gerado:', result.protocol);
      console.log('Status:', result.status);
      console.log('Prioridade sugerida:', result.suggestedPriority);
      console.log('Validador atribuído:', result.assignedValidator);
      console.log('=========================');

      // Upload attachments if any
      if (attachments.length > 0 && result.requestId) {
        console.log(
          `Uploading ${attachments.length} attachment(s) to request ${result.requestId}...`
        );
        for (const attachment of attachments) {
          if (attachment.isTemp && attachment.file) {
            try {
              const attachFormData = new FormData();
              attachFormData.append('file', attachment.file);
              attachFormData.append('uploadedBy', formData.requestingPhysician);

              const uploadResponse = await fetch(`/api/requests/${result.requestId}/attachments`, {
                method: 'POST',
                body: attachFormData,
              });

              if (uploadResponse.ok) {
                console.log('✓ Uploaded:', attachment.file_name);
              } else {
                console.error('✗ Failed to upload:', attachment.file_name);
              }
            } catch (err) {
              console.error('Error uploading attachment:', err);
            }
          }
        }
      }

      // ALWAYS log notification diagnostic, even if undefined
      console.log('=== 📱 NOTIFICATION DIAGNOSTIC ===');
      console.log('Raw diagnostic value:', result.notificationDiagnostic);
      console.log('Type:', typeof result.notificationDiagnostic);

      if (result.notificationDiagnostic) {
        const diag = result.notificationDiagnostic;
        console.log('✓ Validator found:', diag.validatorFound);
        console.log('✓ Telegram enabled:', diag.telegramEnabled);
        console.log('✓ Chat ID configured:', diag.chatIdConfigured);
        console.log('✓ Token configured:', diag.tokenConfigured);
        console.log('✓ Message sent:', diag.messageSent);
        console.log('✓ Success:', diag.success);
        if (diag.error) console.log('✗ Error:', diag.error);
        if (diag.telegramResponse) {
          console.log('📱 Telegram API response:', JSON.stringify(diag.telegramResponse, null, 2));
        }
      } else {
        console.log('⚠️ notificationDiagnostic is:', result.notificationDiagnostic);
      }

      setSubmitResult(result);
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro ao enviar a solicitação. Por favor, tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    if (confirm('Tem certeza que deseja limpar o formulário?')) {
      setFormData({
        medicalRecordNumber: '',
        patientName: '',
        age: '',
        birthDate: '',
        sex: '',
        insurance: '',
        attendingPhysician: '',
        mvSoulNumber: searchParams.get('atendimento') || '',
        origin: '',
        clinicalPresentation: '',
        clinicalPresentationDate: '',
        symptomDuration: '',
        primaryDiagnosis: '',
        differentialDiagnosis: '',
        ecg: '',
        troponin: '',
        vitalSigns: '',
        echocardiogram: '',
        otherExams: '',
        labResults: '',
        hasActiveInfection: '',
        infectiousFocus: '',
        infectionSigns: [],
        infectionSignsOther: '',
        cardiacJustification: '',
        admissionJustification: '',
        clinicalRisk: '',
        riskJustification: '',
        inpatientPlan: '',
        expectedBenefit: '',
        priorityClassification: '',
        agreeTerms: false,
        requestingPhysician: '',
        crm: '',
      });
    }
  };

  const fetchLaudos = async () => {
    if (!patientCode) return;

    setLoadingLaudos(true);
    try {
      const response = await fetch(`/api/mvsoul/laudo?paciente_id=${patientCode}`);
      if (!response.ok) throw new Error('Erro ao buscar laudos');

      const data = await response.json();
      console.log('[LAUDOS] Data received from API:', data);
      if (data.results && data.results.length > 0) {
        console.log('[LAUDOS] First laudo structure:', data.results[0]);
        // Log which laudos have RTF/TXT vs PDF
        data.results.forEach((laudo: any, idx: number) => {
          const hasRtf = !!laudo.ds_laudo_rtf;
          const hasTxt = !!laudo.ds_laudo_txt;
          if (hasRtf || hasTxt) {
            console.log(
              `[LAUDOS] Laudo ${idx} "${laudo.nome_exa_rx}" has text content (RTF: ${hasRtf}, TXT: ${hasTxt})`
            );
          }
        });
      }
      setLaudos(data.results || []);
      setLaudosModalOpen(true);
    } catch (error) {
      console.error('Error fetching laudos:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao buscar laudos do paciente: ' + errorMessage);
    } finally {
      setLoadingLaudos(false);
    }
  };

  const fetchExames = async () => {
    if (!patientCode) return;

    setLoadingExames(true);
    try {
      const response = await fetch(`/api/mvsoul/laudo?paciente_id=${patientCode}`);
      if (!response.ok) throw new Error('Erro ao buscar exames');

      const data = await response.json();
      // Filter for exams that have id_exame_pedido (these can be viewed)
      const examesComVisualizador = (data.results || []).filter(
        (item: any) => item.id_exame_pedido
      );
      setExames(examesComVisualizador);
      setExamesModalOpen(true);
    } catch (error) {
      console.error('Error fetching exames:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao buscar exames do paciente: ' + errorMessage);
    } finally {
      setLoadingExames(false);
    }
  };

  const openLaudoPdf = async (idExamePedido: string) => {
    // Set loading state
    setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'loading' }));

    try {
      // Find the laudo in the cached list to check if it has text content
      const laudo = laudos.find((l: any) => l.id_exame_pedido === idExamePedido);

      if (laudo && (laudo.ds_laudo_rtf || laudo.ds_laudo_txt)) {
        console.log(`[LAUDO] Laudo has text content (RTF/TXT), displaying as text`);
        await openLaudoTextDirect(laudo);
        return;
      }

      // Try to fetch as PDF
      console.log(`[LAUDO] Attempting to fetch PDF for exam ID: ${idExamePedido}`);
      const response = await fetch(`/api/mvsoul/laudo/pdf/${idExamePedido}`);

      // Check if response indicates non-PDF format
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // If it's RTF/TXT format, show text content if available
        if (
          errorData?.error === 'not_pdf' ||
          errorData?.format === 'rtf' ||
          errorData?.format === 'text'
        ) {
          console.log('[LAUDO] PDF endpoint returned text format, trying text display');
          if (laudo) {
            await openLaudoTextDirect(laudo);
            return;
          }
        }

        const errorMessage = errorData?.error || 'Erro ao buscar PDF';
        const errorDetails = errorData?.details || '';
        console.error('[LAUDO] Error response from API:', errorData);

        // Set error state
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert(`${errorMessage}${errorDetails ? '\n\nDetalhes: ' + errorDetails : ''}`);
        return;
      }

      // The endpoint now returns the PDF as binary, not JSON
      const pdfBlob = await response.blob();
      console.log('[LAUDO] PDF blob received:', pdfBlob.type, pdfBlob.size, 'bytes');

      // Validate that we got a PDF
      if (pdfBlob.type !== 'application/pdf' && pdfBlob.type !== '') {
        console.log('[LAUDO] Invalid content type, trying text format');
        await openLaudoText(idExamePedido);
        return;
      }

      if (pdfBlob.size === 0) {
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert('PDF vazio recebido do servidor');
        return;
      }

      // Check if blob contains actual PDF data
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...uint8Array.slice(0, 5));
      console.log('[LAUDO] PDF header check:', header);

      if (!header.startsWith('%PDF')) {
        console.error('[LAUDO] Invalid PDF header, content is not a valid PDF');
        console.log('[LAUDO] First 100 bytes:', String.fromCharCode(...uint8Array.slice(0, 100)));

        // Check if it's RTF content
        const fullContent = String.fromCharCode(...uint8Array);
        if (fullContent.startsWith('{\\rtf')) {
          console.log('[LAUDO] Detected RTF content from API, attempting to fetch text version');

          // Try to fetch text version from database instead of showing raw RTF
          try {
            await openLaudoText(idExamePedido);
            return;
          } catch (textError) {
            console.error('[LAUDO] Failed to fetch text version:', textError);
            setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
            alert(
              'Este laudo está em formato RTF mas não foi possível converter para texto legível.'
            );
            return;
          }
        }

        // Try to display as text if it's not a PDF and we have cached text data
        if (laudo && (laudo.ds_laudo_rtf || laudo.ds_laudo_txt)) {
          console.log('[LAUDO] Trying to display cached text instead');
          await openLaudoTextDirect(laudo);
          return;
        }

        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert('O conteúdo recebido não é um PDF válido e não há formato de texto disponível');
        return;
      }

      console.log('[LAUDO] Creating blob URL and opening in new window');
      const blobUrl = URL.createObjectURL(pdfBlob);
      console.log('[LAUDO] Blob URL created:', blobUrl);

      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow) {
        console.error('[LAUDO] Failed to open new window - popup blocked?');
        alert('Não foi possível abrir o PDF. Por favor, permita pop-ups para este site.');
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        return;
      }

      console.log('[LAUDO] PDF opened successfully');

      // Set success state
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'success' }));
    } catch (error) {
      console.error('[LAUDO] Error opening laudo PDF:', error);
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao abrir PDF do laudo: ' + errorMessage);
    }
  };

  const openLaudoText = async (idExamePedido: string) => {
    try {
      console.log('[LAUDO TEXT] Fetching text for exam ID:', idExamePedido);
      const response = await fetch(`/api/mvsoul/laudo/${idExamePedido}/text`);

      if (!response.ok) {
        console.error('[LAUDO TEXT] Response not OK:', response.status);
        const errorText = await response.text();
        console.error('[LAUDO TEXT] Error response:', errorText);
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert('Erro ao buscar texto do laudo: ' + response.status);
        return;
      }

      const textData = await response.json();
      console.log('[LAUDO TEXT] Received data:', {
        has_rtf: textData.has_rtf,
        has_txt: textData.has_txt,
        format: textData.format,
        rtf_length: textData.ds_laudo_rtf?.length || 0,
        txt_length: textData.ds_laudo_txt?.length || 0,
      });

      // Get text content (prefer TXT over RTF for display)
      const textContent = textData.ds_laudo_txt || textData.ds_laudo_rtf;

      if (!textContent) {
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert('Laudo não possui conteúdo de texto disponível');
        return;
      }

      // Open text content in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Laudo - ${textData.nome_exa_rx || 'Exame'}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 20px;
                max-width: 900px;
                margin: 0 auto;
                background: #f5f5f5;
              }
              .header {
                background: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                white-space: pre-wrap;
                font-size: 14px;
                line-height: 1.6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 {
                margin: 0 0 10px 0;
                font-size: 20px;
                color: #333;
              }
              .meta {
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${textData.nome_exa_rx || 'Laudo'}</h1>
              <div class="meta">Data: ${textData.dt_laudo ? new Date(textData.dt_laudo).toLocaleDateString('pt-BR') : 'N/A'}</div>
            </div>
            <div class="content">${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }

      // Set success state
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'success' }));
    } catch (error) {
      console.error('Error opening laudo text:', error);
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao abrir texto do laudo: ' + errorMessage);
    }
  };

  // Open text content directly from cached laudo object
  const openLaudoTextDirect = async (laudo: any) => {
    try {
      const idExamePedido = laudo.id_exame_pedido;
      console.log('[LAUDO TEXT DIRECT] Opening text for:', laudo.nome_exa_rx);

      // Get text content (prefer TXT over RTF for display)
      const textContent = laudo.ds_laudo_txt || laudo.ds_laudo_rtf;

      if (!textContent) {
        setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
        alert('Laudo não possui conteúdo de texto disponível');
        return;
      }

      console.log('[LAUDO TEXT DIRECT] Content length:', textContent.length);

      // Open text content in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Laudo - ${laudo.nome_exa_rx || 'Exame'}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 20px;
                max-width: 900px;
                margin: 0 auto;
                background: #f5f5f5;
              }
              .header {
                background: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                white-space: pre-wrap;
                font-size: 14px;
                line-height: 1.6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 {
                margin: 0 0 10px 0;
                font-size: 20px;
                color: #333;
              }
              .meta {
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${laudo.nome_exa_rx || 'Laudo'}</h1>
              <div class="meta">Data: ${laudo.dt_laudo ? new Date(laudo.dt_laudo).toLocaleDateString('pt-BR') : 'N/A'}</div>
              <div class="meta">Formato: ${laudo.ds_laudo_txt ? 'Texto' : 'RTF'}</div>
            </div>
            <div class="content">${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }

      // Set success state
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'success' }));
    } catch (error) {
      console.error('[LAUDO TEXT DIRECT] Error:', error);
      const idExamePedido = laudo.id_exame_pedido;
      setLaudoStatus((prev) => ({ ...prev, [idExamePedido]: 'error' }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao abrir texto do laudo: ' + errorMessage);
    }
  };

  const openExameVisualizador = async (idExamePedido: string) => {
    try {
      const response = await fetch(`/api/mvsoul/pacs/${idExamePedido}/visualizador`);
      if (!response.ok) throw new Error('Erro ao buscar visualizador');

      const data = await response.json();
      if (data.link) {
        // Open visualizer in new window
        window.open(data.link, '_blank');
      } else {
        alert('Visualizador não disponível para este exame');
      }
    } catch (error) {
      console.error('Error opening visualizador:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao abrir visualizador do exame: ' + errorMessage);
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo não pode ser maior que 10MB');
      return;
    }

    setUploadingAttachment(true);
    try {
      const tempAttachment = {
        id: `temp-${Date.now()}`,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file: file,
        isTemp: true,
      };

      setAttachments((prev) => [...prev, tempAttachment]);
    } catch (error) {
      console.error('Error preparing attachment:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Erro ao adicionar anexo: ' + errorMessage);
    } finally {
      setUploadingAttachment(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleNewRequest = () => {
    setSubmitResult(null);
    setSubmitError(null);
    setPatientCode(null);
    setLaudos([]);
    setExames([]);
    setAttachments([]);
    handleClear();
  };

  // Fetch patient data from MVSOUL API when attendance number changes
  useEffect(() => {
    const fetchPatientData = async () => {
      const atendimento = formData.mvSoulNumber.trim();

      // Only fetch if we have a number
      if (!atendimento) return;

      try {
        const response = await fetch(
          `https://rede.hospitalprontocardio.com.br/api/atend-ndir/${atendimento}`
        );

        if (!response.ok) {
          console.error('Failed to fetch patient data from MVSOUL');
          return;
        }

        const data = await response.json();

        // Calculate age from birth date
        let age = '';
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

        // Map sex from API (s/m) to form values (masculino/feminino)
        let sex = '';
        if (data.tp_sexo) {
          const sexLower = data.tp_sexo.toLowerCase();
          if (sexLower === 'm') {
            sex = 'masculino';
          } else if (sexLower === 'f' || sexLower === 's') {
            sex = 'feminino';
          }
        }

        // Update form fields with patient data
        setFormData((prev) => ({
          ...prev,
          patientName: data.nm_paciente || prev.patientName,
          age: age || prev.age,
          sex: sex || prev.sex,
          insurance: data.nm_convenio || prev.insurance,
        }));
      } catch (error) {
        console.error('Error fetching patient data:', error);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchPatientData, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.mvSoulNumber]);

  // Show confirmation screen after successful submission
  if (submitResult) {
    return <RequestConfirmation result={submitResult} onNewRequest={handleNewRequest} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Simple Header - MVSoul Style */}
      <div className="bg-[#5A7B9A] text-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png"
              alt="Núcleo de Validação Clínica"
              className="h-10 object-contain"
            />
            <div className="text-base font-normal">Protocolo Digital de Pré-Internação</div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Display */}
          {submitError && (
            <Card className="border border-red-300 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-900 mb-1">
                      Erro ao enviar solicitação
                    </div>
                    <div className="text-sm text-red-700 whitespace-pre-wrap">{submitError}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MVSOUL Search Card - First Step */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Buscar Atendimento MVSOUL</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div>
                <Label htmlFor="mvSoulNumber" className="text-sm font-medium text-gray-700">
                  Número do atendimento MVSOUL *
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="mvSoulNumber"
                    value={formData.mvSoulNumber}
                    onChange={(e) => updateField('mvSoulNumber', e.target.value)}
                    required
                    className="flex-1"
                    placeholder="Digite o número do atendimento"
                  />
                  <Button
                    type="button"
                    onClick={fetchPatientDataManual}
                    disabled={isFetchingPatient || !formData.mvSoulNumber}
                    className="shrink-0 bg-[#5A7B9A] hover:bg-[#4A6B8A]"
                  >
                    {isFetchingPatient ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Buscar
                  </Button>
                </div>
                {fetchPatientError && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {fetchPatientError}
                  </p>
                )}
                {fetchPatientSuccess && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {fetchPatientSuccess}
                  </p>
                )}

                {/* Laudos and Exames buttons - only show after patient data is loaded */}
                {patientCode && (
                  <div className="flex gap-2 mt-3">
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
              </div>
            </CardContent>
          </Card>

          {/* Laudos Modal */}
          <Dialog open={laudosModalOpen} onOpenChange={setLaudosModalOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Laudos do Paciente</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {laudos.filter((laudo) => laudo.dt_laudo).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum laudo encontrado</p>
                ) : (
                  laudos
                    .filter((laudo) => laudo.dt_laudo)
                    .map((laudo, index) => {
                      const status = laudo.id_exame_pedido
                        ? laudoStatus[laudo.id_exame_pedido]
                        : undefined;

                      return (
                        <div
                          key={index}
                          className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            laudo.id_exame_pedido && openLaudoPdf(laudo.id_exame_pedido)
                          }
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {laudo.nome_exa_rx || 'Exame não especificado'}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                Data:{' '}
                                {laudo.dt_laudo
                                  ? new Date(laudo.dt_laudo).toLocaleDateString('pt-BR')
                                  : 'N/A'}
                              </div>
                              {laudo.cd_atendimento && (
                                <div className="text-sm text-gray-500">
                                  Atendimento: {laudo.cd_atendimento}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {status === 'loading' && (
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                              )}
                              {status === 'success' && (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              )}
                              {status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                              <FileText className="h-5 w-5 text-blue-600" />
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    O carregamento das imagens dos exames pode demorar aproximadamente 20 segundos.
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                {exames.filter((exame) => exame.dt_laudo).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Nenhum exame com visualizador encontrado
                  </p>
                ) : (
                  exames
                    .filter((exame) => exame.dt_laudo)
                    .map((exame, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          exame.id_exame_pedido && openExameVisualizador(exame.id_exame_pedido)
                        }
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {exame.nome_exa_rx || 'Exame não especificado'}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Data:{' '}
                              {exame.dt_laudo
                                ? new Date(exame.dt_laudo).toLocaleDateString('pt-BR')
                                : 'N/A'}
                            </div>
                            {exame.cd_atendimento && (
                              <div className="text-sm text-gray-500">
                                Atendimento: {exame.cd_atendimento}
                              </div>
                            )}
                          </div>
                          <ImageIcon className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Section 1: Patient Identification */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Identificação do Paciente</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                  <div>
                    <Label
                      htmlFor="medicalRecordNumber"
                      className="text-sm font-medium text-gray-700"
                    >
                      Número do prontuário *
                    </Label>
                    <Input
                      id="medicalRecordNumber"
                      value={formData.medicalRecordNumber}
                      onChange={(e) => updateField('medicalRecordNumber', e.target.value)}
                      required
                      className="mt-1.5"
                      readOnly
                    />
                  </div>

                  <div>
                    <Label htmlFor="patientName" className="text-sm font-medium text-gray-700">
                      Nome do paciente *
                    </Label>
                    <Input
                      id="patientName"
                      value={formData.patientName}
                      onChange={(e) => updateField('patientName', e.target.value)}
                      required
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="age" className="text-sm font-medium text-gray-700">
                      Idade *
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => updateField('age', e.target.value)}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birthDate" className="text-sm font-medium text-gray-700">
                      Data de nascimento
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleBirthDateChange(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Sexo *</Label>
                  <RadioGroup
                    value={formData.sex}
                    onValueChange={(value) => updateField('sex', value)}
                    required
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="masculino" id="masculino" />
                      <Label htmlFor="masculino" className="font-normal cursor-pointer">
                        Masculino
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="feminino" id="feminino" />
                      <Label htmlFor="feminino" className="font-normal cursor-pointer">
                        Feminino
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="insurance" className="text-sm font-medium text-gray-700">
                    Convênio *
                  </Label>
                  <Input
                    id="insurance"
                    value={formData.insurance}
                    onChange={(e) => updateField('insurance', e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="attendingPhysician" className="text-sm font-medium text-gray-700">
                    Médico assistente *
                  </Label>
                  <Input
                    id="attendingPhysician"
                    value={formData.attendingPhysician}
                    onChange={(e) => updateField('attendingPhysician', e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="origin" className="text-sm font-medium text-gray-700">
                    Origem *
                  </Label>
                  <Select
                    value={formData.origin}
                    onValueChange={(value) => updateField('origin', value)}
                    required
                  >
                    <SelectTrigger id="origin" className="mt-1.5">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambulatorio">Ambulatório</SelectItem>
                      <SelectItem value="emergencia">Emergência</SelectItem>
                      <SelectItem value="eletivo">Eletivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Initial Clinical Data */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Dados Clínicos Iniciais</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label htmlFor="clinicalPresentation" className="text-sm font-medium text-gray-700">
                  Quadro clínico atual *
                </Label>
                <Textarea
                  id="clinicalPresentation"
                  value={formData.clinicalPresentation}
                  onChange={(e) => updateField('clinicalPresentation', e.target.value)}
                  rows={4}
                  required
                  className="mt-1.5"
                />
                {formData.clinicalPresentationDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Data da evolução:{' '}
                    {new Date(formData.clinicalPresentationDate).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="symptomDuration" className="text-sm font-medium text-gray-700">
                  Tempo de evolução dos sintomas
                </Label>
                <Input
                  id="symptomDuration"
                  value={formData.symptomDuration}
                  onChange={(e) => updateField('symptomDuration', e.target.value)}
                  placeholder="Ex: 2 horas, 3 dias"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="primaryDiagnosis" className="text-sm font-medium text-gray-700">
                  Hipótese diagnóstica principal *
                </Label>
                <Textarea
                  id="primaryDiagnosis"
                  value={formData.primaryDiagnosis}
                  onChange={(e) => updateField('primaryDiagnosis', e.target.value)}
                  rows={3}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label
                  htmlFor="differentialDiagnosis"
                  className="text-sm font-medium text-gray-700"
                >
                  Diagnósticos diferenciais relevantes
                </Label>
                <Textarea
                  id="differentialDiagnosis"
                  value={formData.differentialDiagnosis}
                  onChange={(e) => updateField('differentialDiagnosis', e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Objective Data */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Dados Objetivos Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label htmlFor="ecg" className="text-sm font-medium text-gray-700">
                  ECG *
                </Label>
                <Textarea
                  id="ecg"
                  value={formData.ecg}
                  onChange={(e) => updateField('ecg', e.target.value)}
                  rows={3}
                  required
                  placeholder="Descrever achados do ECG"
                  className="mt-1.5"
                />
              </div>

              {formData.origin === 'emergencia' && (
                <div>
                  <Label htmlFor="troponin" className="text-sm font-medium text-gray-700">
                    Troponina
                  </Label>
                  <Input
                    id="troponin"
                    value={formData.troponin}
                    onChange={(e) => updateField('troponin', e.target.value)}
                    placeholder="Ex: Negativa, Positiva (valor)"
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="vitalSigns" className="text-sm font-medium text-gray-700">
                  Sinais vitais *
                </Label>
                <Textarea
                  id="vitalSigns"
                  value={formData.vitalSigns}
                  onChange={(e) => updateField('vitalSigns', e.target.value)}
                  rows={2}
                  required
                  placeholder="PA, FC, FR, SatO2, Temperatura"
                />
              </div>

              <div>
                <Label htmlFor="echocardiogram" className="text-sm font-medium text-gray-700">
                  Ecocardiograma (se houver)
                </Label>
                <Textarea
                  id="echocardiogram"
                  value={formData.echocardiogram}
                  onChange={(e) => updateField('echocardiogram', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="otherExams" className="text-sm font-medium text-gray-700">
                  Angiotomografia / teste funcional / outros exames (se houver)
                </Label>
                <Textarea
                  id="otherExams"
                  value={formData.otherExams}
                  onChange={(e) => updateField('otherExams', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="labResults" className="text-sm font-medium text-gray-700">
                  Exames laboratoriais relevantes
                </Label>
                <Textarea
                  id="labResults"
                  value={formData.labResults}
                  onChange={(e) => updateField('labResults', e.target.value)}
                  rows={3}
                  placeholder="Hemograma, função renal, eletrólitos, etc."
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Infectious Assessment */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Avaliação Infecciosa</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Presença de quadro infeccioso ativo *
                </Label>
                <RadioGroup
                  value={formData.hasActiveInfection}
                  onValueChange={(value) => {
                    updateField('hasActiveInfection', value);
                    if (value === 'nao') {
                      updateField('infectiousFocus', '');
                    }
                  }}
                  required
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="infectionNo" />
                    <Label htmlFor="infectionNo" className="font-normal cursor-pointer">
                      Não
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="infectionYes" />
                    <Label htmlFor="infectionYes" className="font-normal cursor-pointer">
                      Sim
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.hasActiveInfection === 'sim' && (
                <div>
                  <Label htmlFor="infectiousFocus" className="text-sm font-medium text-gray-700">
                    Descrever foco provável *
                  </Label>
                  <Textarea
                    id="infectiousFocus"
                    value={formData.infectiousFocus}
                    onChange={(e) => updateField('infectiousFocus', e.target.value)}
                    rows={3}
                    required
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-gray-700">Sinais de infecção</Label>
                <div className="space-y-2 mt-2">
                  {['Febre', 'Leucocitose', 'PCR elevada', 'Outros'].map((sign) => (
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
                {formData.infectionSigns.includes('Outros') && (
                  <div className="mt-3">
                    <Label
                      htmlFor="infectionSignsOther"
                      className="text-sm font-medium text-gray-700"
                    >
                      Descrever outros sinais de infecção
                    </Label>
                    <Textarea
                      id="infectionSignsOther"
                      value={formData.infectionSignsOther}
                      onChange={(e) => updateField('infectionSignsOther', e.target.value)}
                      rows={2}
                      placeholder="Descreva outros sinais de infecção observados..."
                      className="mt-1.5"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Admission Justification */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Justificativa da Internação</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label
                  htmlFor="admissionJustification"
                  className="text-sm font-medium text-gray-700"
                >
                  Justificativa clínica para internação *
                </Label>
                <Textarea
                  id="admissionJustification"
                  value={formData.admissionJustification}
                  onChange={(e) => updateField('admissionJustification', e.target.value)}
                  rows={4}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="clinicalRisk" className="text-sm font-medium text-gray-700">
                  Risco clínico atual *
                </Label>
                <Select
                  value={formData.clinicalRisk}
                  onValueChange={(value) => updateField('clinicalRisk', value)}
                  required
                >
                  <SelectTrigger id="clinicalRisk" className="mt-1.5">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="moderado">Moderado</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="riskJustification" className="text-sm font-medium text-gray-700">
                  Justificativa do risco
                </Label>
                <Textarea
                  id="riskJustification"
                  value={formData.riskJustification}
                  onChange={(e) => updateField('riskJustification', e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="inpatientPlan" className="text-sm font-medium text-gray-700">
                  Plano intra-hospitalar proposto *
                </Label>
                <Textarea
                  id="inpatientPlan"
                  value={formData.inpatientPlan}
                  onChange={(e) => updateField('inpatientPlan', e.target.value)}
                  rows={4}
                  required
                  placeholder="Descrever propedêutica, terapêutica e metas"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="expectedBenefit" className="text-sm font-medium text-gray-700">
                  Benefício esperado com a internação *
                </Label>
                <Textarea
                  id="expectedBenefit"
                  value={formData.expectedBenefit}
                  onChange={(e) => updateField('expectedBenefit', e.target.value)}
                  rows={3}
                  required
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Priority Classification */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Classificação de Prioridade</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label
                  htmlFor="priorityClassification"
                  className="text-sm font-medium text-gray-700"
                >
                  Classificação de prioridade *
                </Label>
                <Select
                  value={formData.priorityClassification}
                  onValueChange={(value) => updateField('priorityClassification', value)}
                  required
                >
                  <SelectTrigger id="priorityClassification" className="mt-1.5">
                    <SelectValue placeholder="Selecione a prioridade..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imediata">🔴 Imediata (SLA: 10 min)</SelectItem>
                    <SelectItem value="urgente">🟠 Urgente (SLA: 15 min)</SelectItem>
                    <SelectItem value="eletiva">🔵 Eletiva (SLA: 30 min)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Priority Indicator */}
                {formData.priorityClassification && (
                  <div className="mt-3 p-3 rounded border bg-blue-50 text-sm">
                    {formData.priorityClassification === 'imediata' && (
                      <p className="text-red-700">
                        <strong>Prioridade Imediata:</strong> Caso elegível para fast-track. SLA de
                        resposta: 10 minutos.
                      </p>
                    )}
                    {formData.priorityClassification === 'urgente' && (
                      <p className="text-orange-700">
                        <strong>Prioridade Urgente:</strong> Validação rápida necessária. SLA de
                        resposta: 15 minutos.
                      </p>
                    )}
                    {formData.priorityClassification === 'eletiva' && (
                      <p className="text-blue-700">
                        <strong>Prioridade Eletiva:</strong> Internação programada. SLA de resposta:
                        30 minutos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Anexos (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Anexar documentos, imagens ou exames
                </Label>
                <p className="text-xs text-gray-500">
                  Você pode anexar fotos, PDFs ou documentos que auxiliem na validação (máx. 10MB
                  por arquivo)
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('attachment-input')?.click()}
                    disabled={uploadingAttachment}
                    className="h-9"
                  >
                    {uploadingAttachment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Selecionar arquivo
                      </>
                    )}
                  </Button>
                  <input
                    id="attachment-input"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                  />
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {attachment.file_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.file_size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Terms and Signature */}
          <Card className="border border-gray-300 bg-white shadow-sm">
            <CardHeader className="bg-[#5A7B9A] text-white py-2.5 px-4">
              <CardTitle className="text-sm font-medium">Termo de Responsabilidade</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded border border-blue-200">
                <Checkbox
                  id="terms"
                  checked={formData.agreeTerms}
                  onCheckedChange={(checked) => updateField('agreeTerms', checked)}
                  required
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  Declaro que a solicitação de internação está baseada em critérios clínicos,
                  evidência disponível e necessidade assistencial do paciente, não havendo motivação
                  por conveniência não assistencial, e que foi avaliada a presença de condição
                  infecciosa associada.
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="requestingPhysician"
                    className="text-sm font-medium text-gray-700"
                  >
                    Nome do médico solicitante *
                  </Label>
                  <Input
                    id="requestingPhysician"
                    value={formData.requestingPhysician}
                    onChange={(e) => updateField('requestingPhysician', e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="crm" className="text-sm font-medium text-gray-700">
                    CRM *
                  </Label>
                  <Input
                    id="crm"
                    value={formData.crm}
                    onChange={(e) => updateField('crm', e.target.value)}
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={isSubmitting}
              className="h-10 px-6"
            >
              Limpar formulário
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#5A7B9A] hover:bg-[#4A6B8A] h-10 px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar solicitação'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
