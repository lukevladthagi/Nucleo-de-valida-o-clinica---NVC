import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { RequestFormSchema } from '@/shared/types';

function getSlaMinutes(priority: string) {
  if (priority === 'imediata') return 10;
  if (priority === 'urgente') return 15;
  return 30;
}

function createProtocol() {
  return `NDIR${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function getBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const proto = forwardedProto || (host?.startsWith('localhost') ? 'http' : 'http');
  return host ? `${proto}://${host}` : process.env.BETTER_AUTH_URL || process.env.AUTH_URL || '';
}

function escapeTelegram(text: string) {
  return text.replace(/[&<>]/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    return '&gt;';
  });
}

async function getTelegramToken() {
  const rows = await sql`
    SELECT setting_key, setting_value
    FROM settings
    WHERE setting_key IN ('telegram_enabled', 'telegram_bot_token')
  `;

  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const enabled = settings.telegram_enabled === '1' || settings.telegram_enabled === 'true';
  const token = settings.telegram_bot_token || '';

  return enabled && token ? token : '';
}

async function notifyValidators(protocol: string, formData: any, baseUrl: string) {
  const token = await getTelegramToken();
  const diagnostic: any[] = [];

  if (!token) {
    return { sent: 0, total: 0, diagnostic: [{ message: 'Telegram desabilitado ou sem token configurado' }] };
  }

  const validators = await sql`
    SELECT id, name, telegram_chat_id
    FROM validators
    WHERE COALESCE(is_active, 0) = 1
      AND COALESCE(notification_telegram, 0) = 1
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id <> ''
    ORDER BY name ASC
  `;

  const validationUrl = `${baseUrl}/validacao/${encodeURIComponent(protocol)}`;
  const message = [
    '<b>Nova solicitação de pré-internação</b>',
    '',
    `<b>Protocolo:</b> ${escapeTelegram(protocol)}`,
    `<b>Paciente:</b> ${escapeTelegram(formData.patientName)}`,
    `<b>Atendimento MVSOUL:</b> ${escapeTelegram(formData.mvSoulNumber)}`,
    `<b>Convênio:</b> ${escapeTelegram(formData.insurance)}`,
    `<b>Prioridade:</b> ${escapeTelegram(formData.priorityClassification)}`,
    `<b>Médico solicitante:</b> ${escapeTelegram(formData.requestingPhysician)} - CRM ${escapeTelegram(formData.crm)}`,
    '',
    `<a href="${validationUrl}">Abrir validação</a>`,
  ].join('\n');

  let sent = 0;

  for (const validator of validators) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: validator.telegram_chat_id,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok !== false) {
        sent += 1;
        diagnostic.push({ validatorId: validator.id, validatorName: validator.name, ok: true });
      } else {
        diagnostic.push({
          validatorId: validator.id,
          validatorName: validator.name,
          ok: false,
          status: response.status,
          message: result.description || 'Falha ao enviar Telegram',
        });
      }
    } catch (error: any) {
      diagnostic.push({
        validatorId: validator.id,
        validatorName: validator.name,
        ok: false,
        message: error?.message || 'Erro desconhecido',
      });
    }
  }

  return { sent, total: validators.length, diagnostic };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let queryStr = `
      SELECT 
        id, protocol, patient_name, age AS patient_age, sex AS patient_gender,
        insurance, requesting_physician, crm, mvsoul_number, origin,
        priority_classification, clinical_risk, status, created_at,
        sla_minutes, sla_deadline, is_sla_expired, assigned_validator_id,
        validator_physician, validator_crm, decision, decision_justification,
        decision_at, medical_record_number, clinical_presentation,
        primary_diagnosis, admission_justification
      FROM requests
    `;
    const values: unknown[] = [];

    if (status) {
      values.push(status);
      queryStr += ` WHERE LOWER(status) = LOWER($${values.length})`;
    }

    queryStr += ` ORDER BY created_at DESC`;
    values.push(limit);
    queryStr += ` LIMIT $${values.length}`;

    const rows = await sql(queryStr, values);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json({ error: 'Erro ao buscar solicitações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const validation = RequestFormSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos', errors: validation.error.errors }, { status: 400 });
    }

    const formData = validation.data;
    const now = new Date();
    const nowIso = now.toISOString();
    const protocol = createProtocol();
    const slaMinutes = getSlaMinutes(formData.priorityClassification);
    const slaDeadline = new Date(now.getTime() + slaMinutes * 60 * 1000).toISOString();
    const infectionSigns = [
      ...formData.infectionSigns,
      formData.infectionSignsOther ? `Outro: ${formData.infectionSignsOther}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const inserted = await sql`
      INSERT INTO requests (
        id, created_at, updated_at, protocol, status,
        patient_name, age, sex, insurance, attending_physician, mvsoul_number, origin,
        clinical_presentation, symptom_duration, primary_diagnosis, differential_diagnosis,
        ecg, troponin, vital_signs, echocardiogram, other_exams, lab_results,
        has_active_infection, infectious_focus, infection_signs, is_non_cardiac_infection,
        cardiac_justification, admission_justification, clinical_risk, risk_justification,
        inpatient_plan, expected_benefit, priority_classification, suggested_priority,
        requesting_physician, crm, sla_minutes, sla_deadline, is_sla_expired,
        medical_record_number
      )
      VALUES (
        (SELECT COALESCE(MAX(id), 0) + 1 FROM requests),
        ${nowIso}, ${nowIso}, ${protocol}, ${'aguardando_validacao'},
        ${formData.patientName}, ${Number.parseInt(formData.age, 10) || 0}, ${formData.sex},
        ${formData.insurance}, ${formData.attendingPhysician}, ${formData.mvSoulNumber}, ${formData.origin},
        ${formData.clinicalPresentation}, ${formData.symptomDuration || null},
        ${formData.primaryDiagnosis}, ${formData.differentialDiagnosis || null},
        ${formData.ecg}, ${formData.troponin || ''}, ${formData.vitalSigns},
        ${formData.echocardiogram || null}, ${formData.otherExams || null}, ${formData.labResults || null},
        ${formData.hasActiveInfection}, ${formData.infectiousFocus || null}, ${infectionSigns || null},
        ${(payload.isNonCardiacInfection as string) || null}, ${formData.cardiacJustification || null},
        ${formData.admissionJustification}, ${formData.clinicalRisk}, ${formData.riskJustification || null},
        ${formData.inpatientPlan}, ${formData.expectedBenefit}, ${formData.priorityClassification},
        ${payload.suggestedPriority || null}, ${formData.requestingPhysician}, ${formData.crm},
        ${slaMinutes}, ${slaDeadline}, ${0}, ${payload.medicalRecordNumber || null}
      )
      RETURNING id
    `;

    const telegram = await notifyValidators(protocol, formData, getBaseUrl(request));

    return NextResponse.json({
      success: true,
      requestId: inserted[0]?.id,
      protocol,
      status: 'aguardando_validacao',
      priority: formData.priorityClassification,
      slaMinutes,
      slaDeadline,
      telegram,
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json({ error: 'Erro ao enviar solicitação' }, { status: 500 });
  }
}
