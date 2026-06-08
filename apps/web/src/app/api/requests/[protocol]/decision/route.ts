import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { ValidatorDecisionSchema } from '@/shared/types';

function normalizeStatus(decision: string) {
  if (decision === 'aprovada_com_observacao') return 'aprovada';
  return decision;
}

function escapeTelegram(text: unknown) {
  return String(text || '').replace(/[&<>]/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    return '&gt;';
  });
}

function digitsOnly(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function decisionIcon(decision: string) {
  if (decision === 'negada') return '❌';
  if (decision === 'complemento_solicitado') return '🟡';
  return '✅';
}

function decisionTitle(decision: string, target: 'request' | 'admission') {
  if (decision === 'negada') return target === 'request' ? 'Solicitação Negada' : 'Internação Negada';
  if (decision === 'complemento_solicitado') return 'Complemento Solicitado';
  return target === 'request' ? 'Solicitação Aprovada' : 'Internação Aprovada';
}

async function getTelegramSettings() {
  const rows = await sql`
    SELECT setting_key, setting_value
    FROM settings
    WHERE setting_key IN ('telegram_enabled', 'telegram_bot_token', 'telegram_chat_id')
  `;

  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const enabled = settings.telegram_enabled === '1' || settings.telegram_enabled === 'true';

  return {
    token: enabled ? settings.telegram_bot_token || '' : '',
    groupChatId: settings.telegram_chat_id || '',
  };
}

async function sendTelegram(token: string, chatId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      return {
        success: false,
        status: response.status,
        error: result.description || 'Falha ao enviar Telegram',
      };
    }

    return { success: true, messageId: result.result?.message_id };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro desconhecido ao enviar Telegram' };
  }
}

async function notifyDecision(requestRow: any, decision: string, decisionAt: string) {
  const { token, groupChatId } = await getTelegramSettings();
  const errors: string[] = [];
  const diagnostic: any = {
    protocol: requestRow.protocol,
    decision,
    timestamp: decisionAt,
    botTokenConfigured: Boolean(token),
    groupChatIdConfigured: Boolean(groupChatId),
    groupSent: null,
    nursesFound: 0,
    nursesWithTelegram: 0,
    nursesSent: [],
    requestersFound: 0,
    requestersWithTelegram: 0,
    requestersSent: [],
    errors,
  };

  if (!token) {
    errors.push('Telegram desabilitado ou token do bot não configurado.');
    return diagnostic;
  }

  const icon = decisionIcon(decision);
  const groupMessage = [
    `${icon} <b>${escapeTelegram(decisionTitle(decision, 'request'))}</b>`,
    '',
    `<b>Validada por:</b> ${escapeTelegram(requestRow.validator_physician || 'Não informado')} (via Web)`,
    `<b>Protocolo:</b> ${escapeTelegram(requestRow.protocol)}`,
  ].join('\n');

  if (groupChatId) {
    diagnostic.groupSent = await sendTelegram(token, groupChatId, groupMessage);
    if (!diagnostic.groupSent.success) {
      errors.push(`Grupo: ${diagnostic.groupSent.error || 'falha no envio'}`);
    }
  } else {
    errors.push('Chat ID do grupo não configurado em telegram_chat_id.');
  }

  const recipientMessage = [
    `${icon} <b>${escapeTelegram(decisionTitle(decision, 'admission'))}</b>`,
    '',
    `<b>Protocolo:</b> ${escapeTelegram(requestRow.protocol)}`,
    `<b>Paciente:</b> ${escapeTelegram(requestRow.patient_name)}`,
    `<b>Idade:</b> ${escapeTelegram(requestRow.age)} anos`,
    `<b>HD:</b> ${escapeTelegram(requestRow.primary_diagnosis || '-')}`,
    `<b>Convênio:</b> ${escapeTelegram(requestRow.insurance || '-')}`,
    `<b>Médico Assistente:</b> ${escapeTelegram(requestRow.attending_physician || '-')}`,
    `<b>Médico Validador:</b> ${escapeTelegram(requestRow.validator_physician || '-')}`,
    `<b>Médico Solicitante:</b> ${escapeTelegram(requestRow.requesting_physician || '-')}`,
  ].join('\n');

  const nurses = await sql`
    SELECT id, name, telegram_chat_id
    FROM nurses
    WHERE COALESCE(is_active, 0) = 1
    ORDER BY name ASC
  `;
  const nursesWithTelegram = nurses.filter((nurse) => Boolean(String(nurse.telegram_chat_id || '').trim()));
  diagnostic.nursesFound = nurses.length;
  diagnostic.nursesWithTelegram = nursesWithTelegram.length;

  for (const nurse of nursesWithTelegram) {
    const result = await sendTelegram(token, nurse.telegram_chat_id, recipientMessage);
    diagnostic.nursesSent.push({
      id: nurse.id,
      name: nurse.name,
      chat_id: nurse.telegram_chat_id,
      ...result,
    });
    if (!result.success) errors.push(`Enfermagem ${nurse.name}: ${result.error || 'falha no envio'}`);
  }

  const requesterRows = await sql`
    SELECT id, name, crm, telegram_chat_id
    FROM requesters
    WHERE COALESCE(is_active, 0) = 1
    ORDER BY name ASC
  `;
  const requestCrm = digitsOnly(requestRow.crm);
  const requestName = normalizeText(requestRow.requesting_physician);
  const matchingRequesters = requesterRows.filter((requester) => {
    const requesterCrm = digitsOnly(requester.crm);
    const requesterName = normalizeText(requester.name);
    return (
      (requestCrm && requesterCrm && requestCrm === requesterCrm) ||
      (requestName && requesterName && (requestName.includes(requesterName) || requesterName.includes(requestName)))
    );
  });
  const requestersWithTelegram = matchingRequesters.filter((requester) => Boolean(String(requester.telegram_chat_id || '').trim()));
  diagnostic.requestersFound = matchingRequesters.length;
  diagnostic.requestersWithTelegram = requestersWithTelegram.length;

  if (matchingRequesters.length === 0) {
    errors.push('Médico solicitante não encontrado na base de solicitantes pelo CRM/nome.');
  } else if (requestersWithTelegram.length === 0) {
    errors.push('Médico solicitante encontrado, mas sem chat ID do Telegram configurado.');
  }

  for (const requester of requestersWithTelegram) {
    const result = await sendTelegram(token, requester.telegram_chat_id, recipientMessage);
    diagnostic.requestersSent.push({
      id: requester.id,
      name: requester.name,
      chat_id: requester.telegram_chat_id,
      ...result,
    });
    if (!result.success) errors.push(`Solicitante ${requester.name}: ${result.error || 'falha no envio'}`);
  }

  return diagnostic;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { protocol } = await params;
    const payload = await request.json();
    const validation = ValidatorDecisionSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos', errors: validation.error.errors }, { status: 400 });
    }

    const data = validation.data;
    const decisionAt = new Date().toISOString();

    const updated = await sql`
      UPDATE requests
      SET status = ${normalizeStatus(data.decision)},
          decision = ${data.decision},
          validator_physician = ${data.validatorPhysician},
          validator_crm = ${data.validatorCrm},
          decision_justification = ${data.decisionJustification || null},
          decision_observation = ${data.decisionObservation || null},
          decision_at = ${decisionAt},
          updated_at = ${decisionAt}
      WHERE protocol = ${protocol}
      RETURNING *
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const diagnostic = await notifyDecision(updated[0], data.decision, decisionAt);

    return NextResponse.json({
      success: true,
      request: updated[0],
      diagnostic,
    });
  } catch (error) {
    console.error('Error registering decision:', error);
    return NextResponse.json({ error: 'Erro ao registrar decisão' }, { status: 500 });
  }
}
