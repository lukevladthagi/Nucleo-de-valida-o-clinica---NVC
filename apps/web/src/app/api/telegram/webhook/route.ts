import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

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

async function getTelegramToken() {
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

async function callTelegram(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json().catch(() => ({}));
}

async function answerCallback(token: string, callbackQueryId: string, text: string, showAlert = false) {
  await callTelegram(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

async function sendTelegram(token: string, chatId: string, text: string) {
  return callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

async function notifyApprovalRecipients(token: string, groupChatId: string, requestRow: any, validatorName: string) {
  const groupMessage = [
    `✅ <b>Solicitação Aprovada</b>`,
    '',
    `<b>Validada por:</b> ${escapeTelegram(validatorName)} (via Telegram)`,
    `<b>Protocolo:</b> ${escapeTelegram(requestRow.protocol)}`,
  ].join('\n');

  const validators = await sql`
    SELECT name, telegram_chat_id
    FROM validators
    WHERE COALESCE(is_active, 0) = 1
      AND COALESCE(notification_telegram, 0) = 1
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id <> ''
  `;

  const groupRecipients = new Map<string, string>();
  if (groupChatId) groupRecipients.set(String(groupChatId), 'Grupo configurado');
  for (const validator of validators) {
    groupRecipients.set(String(validator.telegram_chat_id), validator.name || 'Validador');
  }

  for (const [chatId] of groupRecipients) {
    await sendTelegram(token, chatId, groupMessage);
  }

  const recipientMessage = [
    `✅ <b>Internação Aprovada</b>`,
    '',
    `<b>Protocolo:</b> ${escapeTelegram(requestRow.protocol)}`,
    `<b>Paciente:</b> ${escapeTelegram(requestRow.patient_name)}`,
    `<b>Idade:</b> ${escapeTelegram(requestRow.age)} anos`,
    `<b>HD:</b> ${escapeTelegram(requestRow.primary_diagnosis || '-')}`,
    `<b>Convênio:</b> ${escapeTelegram(requestRow.insurance || '-')}`,
    `<b>Médico Assistente:</b> ${escapeTelegram(requestRow.attending_physician || '-')}`,
    `<b>Médico Validador:</b> ${escapeTelegram(validatorName)}`,
    `<b>Médico Solicitante:</b> ${escapeTelegram(requestRow.requesting_physician || '-')}`,
  ].join('\n');

  const nurses = await sql`
    SELECT telegram_chat_id
    FROM nurses
    WHERE COALESCE(is_active, 0) = 1
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id <> ''
  `;
  for (const nurse of nurses) {
    await sendTelegram(token, String(nurse.telegram_chat_id), recipientMessage);
  }

  const requesters = await sql`
    SELECT name, crm, telegram_chat_id
    FROM requesters
    WHERE COALESCE(is_active, 0) = 1
      AND telegram_chat_id IS NOT NULL
      AND telegram_chat_id <> ''
  `;
  const requestCrm = digitsOnly(requestRow.crm);
  const requestName = normalizeText(requestRow.requesting_physician);

  for (const requester of requesters) {
    const requesterCrm = digitsOnly(requester.crm);
    const requesterName = normalizeText(requester.name);
    const matches =
      (requestCrm && requesterCrm && requestCrm === requesterCrm) ||
      (requestName && requesterName && (requestName.includes(requesterName) || requesterName.includes(requestName)));

    if (matches) {
      await sendTelegram(token, String(requester.telegram_chat_id), recipientMessage);
    }
  }
}

async function clearTelegramButtons(
  token: string,
  protocol: string,
  statusText: string,
  validatorName: string,
  currentChatId?: string,
  currentMessageId?: number,
) {
  const rows = await sql`
    SELECT recipient, telegram_message_id
    FROM notification_log
    WHERE request_protocol = ${protocol}
      AND channel = 'telegram'
      AND status = 'sent'
      AND telegram_message_id IS NOT NULL
      AND telegram_message_id <> ''
  `;

  const edited = new Set<string>();
  if (currentChatId && currentMessageId) {
    edited.add(`${currentChatId}:${currentMessageId}`);
  }

  for (const row of rows) {
    const chatId = String(row.recipient);
    const messageId = Number(row.telegram_message_id);
    const key = `${chatId}:${messageId}`;
    if (!messageId || edited.has(key)) continue;

    await callTelegram(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `${statusText}\n\n<b>Validada por:</b> ${escapeTelegram(validatorName)} (via Telegram)\n<b>Protocolo:</b> ${escapeTelegram(protocol)}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const callbackQuery = update.callback_query;

    if (!callbackQuery) {
      return NextResponse.json({ ok: true });
    }

    const { token, groupChatId } = await getTelegramToken();
    if (!token) {
      return NextResponse.json({ ok: true });
    }

    const callbackData = String(callbackQuery.data || '');
    const [action, protocol] = callbackData.split(':');
    const chatId = String(callbackQuery.message?.chat?.id || callbackQuery.from?.id || '');
    const messageId = Number(callbackQuery.message?.message_id || 0);

    if (!protocol || !['approve', 'deny'].includes(action)) {
      await answerCallback(token, callbackQuery.id, 'Ação inválida', true);
      return NextResponse.json({ ok: true });
    }

    const validators = await sql`
      SELECT id, name, crm
      FROM validators
      WHERE telegram_chat_id = ${chatId}
      LIMIT 1
    `;
    const validator = validators[0];

    if (!validator) {
      await answerCallback(token, callbackQuery.id, 'Validador não encontrado para este Telegram', true);
      return NextResponse.json({ ok: true });
    }

    const requestRows = await sql`
      SELECT *
      FROM requests
      WHERE protocol = ${protocol}
      LIMIT 1
    `;
    const requestRow = requestRows[0];

    if (!requestRow) {
      await answerCallback(token, callbackQuery.id, 'Solicitação não encontrada', true);
      return NextResponse.json({ ok: true });
    }

    if (!['aguardando_validacao', 'Aguardando validação'].includes(String(requestRow.status))) {
      await answerCallback(token, callbackQuery.id, `Solicitação já está como ${requestRow.status}`, true);
      return NextResponse.json({ ok: true });
    }

    const decision = action === 'approve' ? 'aprovada' : 'negada';
    const statusText = action === 'approve' ? '✅ Solicitação Aprovada' : '❌ Solicitação Negada';
    const decisionAt = new Date().toISOString();

    const updatedRows = await sql`
      UPDATE requests
      SET status = ${decision},
          decision = ${decision},
          validator_physician = ${validator.name},
          validator_crm = ${validator.crm},
          decision_justification = ${`Decisão via Telegram por ${validator.name}`},
          decision_at = ${decisionAt},
          updated_at = ${decisionAt}
      WHERE protocol = ${protocol}
      RETURNING *
    `;
    const updatedRequest = updatedRows[0];

    await answerCallback(token, callbackQuery.id, statusText.replace(/[✅❌]/g, '').trim());

    if (chatId && messageId) {
      await callTelegram(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `${statusText}\n\n<b>Validada por:</b> ${escapeTelegram(validator.name)} (via Telegram)\n<b>Protocolo:</b> ${escapeTelegram(protocol)}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
    }

    await clearTelegramButtons(token, protocol, statusText, validator.name, chatId, messageId);

    if (decision === 'aprovada') {
      await notifyApprovalRecipients(token, groupChatId, updatedRequest, validator.name);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    return NextResponse.json({ ok: true });
  }
}
