// @ts-nocheck
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { RequestFormSchema, ValidatorDecisionSchema } from "@/shared/types";
import {
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { buildNotificationEmail } from "./email-templates";
import { getDiagnostic } from "./approval-diagnostic";

const app = new Hono<{ Bindings: Env }>();

// Generate unique protocol number
function generateProtocol(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `NDIR${timestamp}${random}`;
}

// Send approval notifications to nurses and requesters
async function sendApprovalNotifications(
  db: D1Database, 
  botToken: string, 
  protocol: string, 
  request: any, 
  validatorPhysician: string
): Promise<void> {
  console.log(`[APPROVAL NOTIFICATIONS] Starting for protocol ${protocol}`);
  
  // Build approval notification message
  const approvalMessage = `✅ <b>Internação Aprovada</b>

<b>Protocolo:</b> ${protocol}
<b>Paciente:</b> ${request.patient_name}
<b>Idade:</b> ${request.age} anos
<b>HD:</b> ${request.primary_diagnosis}
<b>Convênio:</b> ${request.insurance}
<b>Médico Assistente:</b> ${request.attending_physician}
<b>Médico Validador:</b> ${validatorPhysician}
<b>Médico Solicitante:</b> ${request.requesting_physician}`;

  console.log(`[APPROVAL NOTIFICATIONS] Bot token available: ${!!botToken}`);
  
  // Get active nurses with Telegram enabled
  const nurses = await db
    .prepare("SELECT * FROM nurses WHERE is_active = 1 AND notification_telegram = 1 AND telegram_chat_id IS NOT NULL")
    .all();
  
  console.log(`[APPROVAL NOTIFICATIONS] Found ${nurses.results?.length || 0} nurses with Telegram enabled`);
  if (nurses.results && nurses.results.length > 0) {
    console.log(`[APPROVAL NOTIFICATIONS] Nurses:`, JSON.stringify(nurses.results));
  }
  
  // Send to each nurse
  for (const nurse of (nurses.results || []) as any[]) {
    const now = new Date().toISOString();
    try {
      console.log(`[APPROVAL NOTIFICATIONS] Sending to nurse ${nurse.name} (chat_id: ${nurse.telegram_chat_id})`);
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: nurse.telegram_chat_id,
          text: approvalMessage,
          parse_mode: "HTML",
        }),
      });
      
      const result: any = await response.json();
      if (result.ok) {
        console.log(`✅ Sent approval notification to nurse ${nurse.name}`);
        await db.prepare(
          `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, sent_at, created_at, telegram_message_id)
           VALUES (?, NULL, 'telegram', ?, 'sent', ?, ?, ?)`
        ).bind(protocol, nurse.telegram_chat_id, now, now, result.result?.message_id?.toString() || null).run();
      } else {
        console.error(`❌ Failed to send to nurse ${nurse.name}:`, result);
        await db.prepare(
          `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, error_message, sent_at, created_at)
           VALUES (?, NULL, 'telegram', ?, 'failed', ?, ?, ?)`
        ).bind(protocol, nurse.telegram_chat_id, JSON.stringify(result), now, now).run();
      }
    } catch (error) {
      console.error(`Error sending approval to nurse ${nurse.id}:`, error);
      await db.prepare(
        `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, error_message, sent_at, created_at)
         VALUES (?, NULL, 'telegram', ?, 'failed', ?, ?, ?)`
      ).bind(protocol, nurse.telegram_chat_id, (error as Error).message, now, now).run();
    }
  }
  
  // Get active requesters with Telegram enabled
  const requesters = await db
    .prepare("SELECT * FROM requesters WHERE is_active = 1 AND notification_telegram = 1 AND telegram_chat_id IS NOT NULL")
    .all();
  
  console.log(`[APPROVAL NOTIFICATIONS] Found ${requesters.results?.length || 0} requesters with Telegram enabled`);
  if (requesters.results && requesters.results.length > 0) {
    console.log(`[APPROVAL NOTIFICATIONS] Requesters:`, JSON.stringify(requesters.results));
  }
  
  // Send to each requester
  for (const requester of (requesters.results || []) as any[]) {
    const now = new Date().toISOString();
    try {
      console.log(`[APPROVAL NOTIFICATIONS] Sending to requester ${requester.name} (chat_id: ${requester.telegram_chat_id})`);
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: requester.telegram_chat_id,
          text: approvalMessage,
          parse_mode: "HTML",
        }),
      });
      
      const result: any = await response.json();
      if (result.ok) {
        console.log(`✅ Sent approval notification to requester ${requester.name}`);
        await db.prepare(
          `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, sent_at, created_at, telegram_message_id)
           VALUES (?, NULL, 'telegram', ?, 'sent', ?, ?, ?)`
        ).bind(protocol, requester.telegram_chat_id, now, now, result.result?.message_id?.toString() || null).run();
      } else {
        console.error(`❌ Failed to send to requester ${requester.name}:`, result);
        await db.prepare(
          `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, error_message, sent_at, created_at)
           VALUES (?, NULL, 'telegram', ?, 'failed', ?, ?, ?)`
        ).bind(protocol, requester.telegram_chat_id, JSON.stringify(result), now, now).run();
      }
    } catch (error) {
      console.error(`Error sending approval to requester ${requester.id}:`, error);
      await db.prepare(
        `INSERT INTO notification_log (request_protocol, validator_id, channel, recipient, status, error_message, sent_at, created_at)
         VALUES (?, NULL, 'telegram', ?, 'failed', ?, ?, ?)`
      ).bind(protocol, requester.telegram_chat_id, (error as Error).message, now, now).run();
    }
  }
  
  console.log(`[APPROVAL NOTIFICATIONS] Finished sending all notifications`);
}

// Calculate SLA based on priority
async function calculateSLA(db: D1Database, priority: string): Promise<{ minutes: number; deadline: Date }> {
  const now = new Date();
  let minutes: number;
  
  // Try to get SLA from settings
  try {
    const settingKey = priority === "imediata" 
      ? "sla_immediate_minutes" 
      : priority === "urgente" 
      ? "sla_urgent_minutes" 
      : "sla_elective_minutes";
    
    const setting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = ?")
      .bind(settingKey)
      .first<{ setting_value: string }>();
    
    if (setting?.setting_value) {
      minutes = parseInt(setting.setting_value);
    } else {
      // Fallback to defaults
      minutes = priority === "imediata" ? 10 : priority === "urgente" ? 15 : 30;
    }
  } catch (error) {
    // Fallback to defaults on error
    minutes = priority === "imediata" ? 10 : priority === "urgente" ? 15 : 30;
  }
  
  const deadline = new Date(now.getTime() + minutes * 60000);
  return { minutes, deadline };
}

// Send notification to a specific validator
async function sendValidatorNotification(env: Env, validatorId: number, requestData: {
  protocol: string;
  medicalRecordNumber: string;
  patientName: string;
  mvSoulNumber: string;
  insurance: string;
  priority: string;
  risk: string;
  slaMinutes: number;
  clinicalPresentation: string;
}): Promise<{
  success: boolean;
  validatorFound: boolean;
  telegramEnabled: boolean;
  chatIdConfigured: boolean;
  tokenConfigured: boolean;
  messageSent: boolean;
  telegramResponse?: any;
  error?: string;
}> {
  console.log("=== 🚀 sendValidatorNotification START ===");
  console.log("📋 Validator ID:", validatorId);
  console.log("📋 Request protocol:", requestData.protocol);
  console.log("📋 Patient:", requestData.patientName);
  console.log("📋 Priority:", requestData.priority);
  console.log("📋 Timestamp:", new Date().toISOString());
  
  const diagnostic = {
    success: false,
    validatorFound: false,
    telegramEnabled: false,
    chatIdConfigured: false,
    tokenConfigured: false,
    messageSent: false,
    telegramResponse: undefined as any,
    error: undefined as string | undefined,
  };
  
  try {
    const db = env.DB;
    
    console.log("🔍 Step 1: Fetching validator from database...");
    
    // Fetch the specific validator
    const validator = await db
      .prepare("SELECT * FROM validators WHERE id = ? AND is_active = 1")
      .bind(validatorId)
      .first();
    
    console.log("✅ Step 1 Complete: Validator query executed");
    console.log("📊 Validator found:", validator ? "✅ YES" : "❌ NO");
    
    if (validator) {
      diagnostic.validatorFound = true;
      console.log("👤 Validator name:", (validator as any).name);
      console.log("📧 Email enabled:", (validator as any).notification_email);
      console.log("📧 Email:", (validator as any).email);
      console.log("📱 Telegram enabled:", (validator as any).notification_telegram);
      console.log("📱 Telegram chat_id:", (validator as any).telegram_chat_id);
    }
    
    if (!validator) {
      diagnostic.error = `Validator ${validatorId} not found or not active`;
      console.log(`❌ ABORT: Validator ${validatorId} not found or not active`);
      return diagnostic;
    }
    
    // Always use production URL for Telegram (it doesn't accept localhost URLs)
    // Email can use environment-specific URLs
    const emailBaseUrl = env.MOCHA_ENV === "production" 
      ? "https://nvc.mocha.app" 
      : "http://localhost:5173";
    const telegramBaseUrl = "https://nvc.mocha.app";
    
    const emailValidationUrl = `${emailBaseUrl}/validacao/${requestData.protocol}`;
    const telegramValidationUrl = `${telegramBaseUrl}/validacao/${requestData.protocol}`;
    
    // Build email content
    const emailContent = buildNotificationEmail({
      ...requestData,
      validationUrl: emailValidationUrl,
    });
    
    // Send email if enabled
    if (validator.notification_email && validator.email) {
      try {
        const result = await env.EMAILS.send({
          to: validator.email as string,
          subject: emailContent.subject,
          html_body: emailContent.html,
          text_body: emailContent.text,
        });
        
        // Log notification
        await db
          .prepare(
            `INSERT INTO notification_log 
             (request_protocol, validator_id, channel, recipient, status, error_message, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            requestData.protocol,
            validator.id,
            "email",
            validator.email,
            result.success ? "sent" : "failed",
            result.error || null,
            new Date().toISOString()
          )
          .run();
        
        if (!result.success) {
          console.error(`Failed to send email to ${validator.email}:`, result.error);
        }
      } catch (error) {
        console.error(`Error sending email to ${validator.email}:`, error);
        
        // Log error
        await db
          .prepare(
            `INSERT INTO notification_log 
             (request_protocol, validator_id, channel, recipient, status, error_message, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            requestData.protocol,
            validator.id,
            "email",
            validator.email,
            "error",
            String(error),
            new Date().toISOString()
          )
          .run();
      }
    }
    
    // Send Telegram if enabled and configured
    if (validator.notification_telegram && validator.telegram_chat_id) {
      console.log("🔍 Step 2: Telegram notification enabled, proceeding...");
      try {
        console.log("🔍 Step 2a: Fetching Telegram bot token from settings...");
        
        // Get Telegram bot token from settings
        const telegramSetting = await db
          .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
          .first();
        
        console.log("✅ Step 2a Complete: Settings query executed");
        console.log("🔑 Telegram token found:", telegramSetting?.setting_value ? "✅ YES" : "❌ NO");
        
        if (telegramSetting?.setting_value) {
          console.log("🔑 Token length:", (telegramSetting.setting_value as string).length);
          console.log("🔑 Token preview:", (telegramSetting.setting_value as string).substring(0, 15) + "...");
        }
        
        if (telegramSetting?.setting_value) {
          const botToken = telegramSetting.setting_value as string;
          const chatId = validator.telegram_chat_id as string;
          
          // Build Telegram message
          const telegramMessage = buildTelegramMessage({
            ...requestData,
            validationUrl: telegramValidationUrl,
          });
          
          // Send via Telegram API
          console.log("🔍 Step 3: Preparing Telegram API call...");
          console.log("🔑 Bot Token (first 15 chars):", botToken.substring(0, 15) + "...");
          console.log("💬 Chat ID:", chatId);
          console.log("📝 Message length:", telegramMessage.length, "characters");
          console.log("🔗 Validation URL:", telegramValidationUrl);
          console.log("🕐 Current time:", new Date().toISOString());
          
          const telegramPayload = {
            chat_id: chatId,
            text: telegramMessage,
            parse_mode: "HTML",
            disable_web_page_preview: false,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Aprovar", callback_data: `approve:${requestData.protocol}` },
                  { text: "❌ Negar", callback_data: `deny:${requestData.protocol}` }
                ],
                [
                  { text: "🌐 Avaliar no sistema", url: telegramValidationUrl }
                ]
              ]
            }
          };
          
          console.log("📦 Full payload:", JSON.stringify(telegramPayload, null, 2));
          
          console.log("🚀 Step 4: Calling Telegram API...");
          console.log("🌐 API URL:", `https://api.telegram.org/bot${botToken.substring(0, 15)}***/sendMessage`);
          console.log("🕐 Request time:", new Date().toISOString());
          
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(telegramPayload),
            }
          );
          
          console.log("✅ Step 4 Complete: Telegram API responded");
          console.log("📊 HTTP Status:", telegramResponse.status);
          console.log("📊 Response OK:", telegramResponse.ok);
          console.log("🕐 Response time:", new Date().toISOString());
          
          console.log("🔍 Step 5: Parsing Telegram API response...");
          const telegramResult: any = await telegramResponse.json();
          
          console.log("✅ Step 5 Complete: Response parsed");
          console.log("=== 📱 TELEGRAM API RESPONSE ===");
          console.log("📊 Full response:", JSON.stringify(telegramResult, null, 2));
          console.log("✅ Success:", telegramResult.ok ? "✅ YES" : "❌ NO");
          
          diagnostic.telegramResponse = telegramResult;
          
          if (!telegramResult.ok) {
            diagnostic.error = `Telegram API error: ${telegramResult.description}`;
            console.error("=== ❌ TELEGRAM ERROR ===");
            console.error("🔴 Error code:", telegramResult.error_code);
            console.error("🔴 Error description:", telegramResult.description);
            console.error("🔴 Full error:", JSON.stringify(telegramResult, null, 2));
          } else {
            diagnostic.messageSent = true;
            diagnostic.success = true;
            console.log("=== ✅ SUCCESS ===");
            console.log("✅ Message sent successfully to Telegram!");
            console.log("📩 Message ID:", telegramResult.result?.message_id);
            console.log("💬 Chat ID confirmed:", telegramResult.result?.chat?.id);
            console.log("🕐 Sent at:", new Date().toISOString());
          }
          
          // Log notification
          console.log("🔍 Step 6: Saving to notification_log...");
          await db
            .prepare(
              `INSERT INTO notification_log 
               (request_protocol, validator_id, channel, recipient, status, error_message, sent_at, telegram_message_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              requestData.protocol,
              validator.id,
              "telegram",
              chatId,
              telegramResult.ok ? "sent" : "failed",
              telegramResult.ok ? null : JSON.stringify(telegramResult),
              new Date().toISOString(),
              telegramResult.ok ? String(telegramResult.result?.message_id) : null
            )
            .run();
          
          console.log("✅ Step 6 Complete: Notification logged to database");
          
          if (!telegramResult.ok) {
            console.error(`❌ Failed to send Telegram to ${chatId}:`, telegramResult);
          }
        } else {
          diagnostic.error = "Telegram bot token not configured in settings";
          console.log("❌ ABORT: Telegram bot token not configured in settings");
        }
      } catch (error) {
        diagnostic.error = error instanceof Error ? error.message : String(error);
        console.error("=== ❌ EXCEPTION IN TELEGRAM BLOCK ===");
        console.error(`🔴 Error sending Telegram to validator ${validator.id}:`, error);
        console.error("🔴 Error type:", typeof error);
        console.error("🔴 Error message:", error instanceof Error ? error.message : String(error));
        console.error("🔴 Error stack:", error instanceof Error ? error.stack : "No stack");
        console.error("🔴 Full error:", error);
        
        // Log error
        await db
          .prepare(
            `INSERT INTO notification_log 
             (request_protocol, validator_id, channel, recipient, status, error_message, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            requestData.protocol,
            validator.id,
            "telegram",
            validator.telegram_chat_id,
            "error",
            error instanceof Error ? error.message : String(error),
            new Date().toISOString()
          )
          .run();
        
        console.log("✅ Error logged to database");
      }
    } else {
      diagnostic.telegramEnabled = false;
      diagnostic.error = "Telegram notification not enabled or chat_id missing";
      console.log("⚠️ SKIP: Telegram notification NOT enabled or missing chat_id");
      console.log("📊 notification_telegram:", (validator as any)?.notification_telegram);
      console.log("📊 telegram_chat_id:", (validator as any)?.telegram_chat_id);
    }
  } catch (error) {
    diagnostic.error = error instanceof Error ? error.message : String(error);
    console.error("=== ❌ FATAL ERROR IN sendValidatorNotification ===");
    console.error("🔴 Error:", error);
    console.error("🔴 Error type:", typeof error);
    console.error("🔴 Error message:", error instanceof Error ? error.message : String(error));
    console.error("🔴 Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("🔴 Full error:", error);
  }
  
  console.log("=== 🏁 sendValidatorNotification END ===");
  console.log("🕐 End time:", new Date().toISOString());
  console.log("📊 DIAGNOSTIC INFO:", JSON.stringify(diagnostic, null, 2));
  
  return diagnostic;
}

// Build Telegram notification message
function buildTelegramMessage(data: {
  protocol: string;
  medicalRecordNumber: string;
  patientName: string;
  mvSoulNumber: string;
  insurance: string;
  priority: string;
  risk: string;
  slaMinutes: number;
  clinicalPresentation: string;
  validationUrl: string;
}) {
  const priorityEmoji = data.priority === "imediata" ? "🔴" : data.priority === "urgente" ? "🟡" : "🔵";
  const riskEmoji = data.risk === "Alto" ? "⚠️" : data.risk === "Moderado" ? "⚡" : "✅";
  
  return `${priorityEmoji} <b>Nova Solicitação de Pré-Internação — NDIR</b>

<b>Protocolo:</b> ${data.protocol}
<b>Prontuário:</b> ${data.medicalRecordNumber || 'N/A'}
<b>Paciente:</b> ${data.patientName}
<b>Atendimento MVSOUL:</b> ${data.mvSoulNumber}
<b>Convênio:</b> ${data.insurance}

<b>Prioridade:</b> ${data.priority.toUpperCase()}
<b>Risco Clínico:</b> ${riskEmoji} ${data.risk}
<b>SLA:</b> ${data.slaMinutes} minutos

<b>Resumo Clínico:</b>
${data.clinicalPresentation}

👉 <a href="${data.validationUrl}">Clique aqui para avaliar</a>`;
}

// Calculate suggested priority based on clinical data
function calculateSuggestedPriority(data: any): string {
  const clinicalRisk = data.clinicalRisk?.toLowerCase();
  const troponin = data.troponin?.toLowerCase() || "";
  const ecg = data.ecg?.toLowerCase() || "";
  const clinicalPresentation = data.clinicalPresentation?.toLowerCase() || "";
  
  // Check for IMMEDIATE/FAST-TRACK criteria
  const hasTypicalChestPain = clinicalPresentation.includes("dor torácica") || 
                              clinicalPresentation.includes("dor no peito") ||
                              clinicalPresentation.includes("precordialgia");
  const hasPositiveTroponin = troponin.includes("positiv") || 
                              troponin.includes("elevad") ||
                              /\d+/.test(troponin); // Contains numbers suggesting positive value
  const hasAbnormalECG = ecg.includes("alterado") || 
                         ecg.includes("supra") || 
                         ecg.includes("st") ||
                         ecg.includes("inversão") ||
                         ecg.includes("bloqueio");
  const hasInstability = clinicalPresentation.includes("instável") ||
                         clinicalPresentation.includes("instabilidade") ||
                         clinicalPresentation.includes("choque");
  
  if ((hasTypicalChestPain && hasPositiveTroponin) ||
      (hasTypicalChestPain && hasAbnormalECG) ||
      hasInstability ||
      clinicalRisk === "alto") {
    return "imediata";
  }
  
  // Check for URGENT criteria
  if (clinicalRisk === "moderado" ||
      ecg.includes("dac") ||
      ecg.includes("coronário") ||
      clinicalPresentation.includes("cardiológico")) {
    return "urgente";
  }
  
  // Default to ELECTIVE
  return "eletiva";
}

// Form access validation endpoint
app.post("/api/validate-form-access", async (c) => {
  try {
    const { code } = await c.req.json();
    
    const db = c.env.DB as D1Database;
    
    // Get the form access settings
    const secureEnabled = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'form_access_secure'")
      .first() as any;
    
    const storedCode = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'form_access_code'")
      .first() as any;
    
    // If secure mode is not enabled, allow access
    if (!secureEnabled || secureEnabled.setting_value !== "1") {
      return c.json({ valid: true });
    }
    
    // Check if provided code matches stored code
    const valid = storedCode && storedCode.setting_value === code;
    
    return c.json({ valid });
  } catch (error) {
    console.error("[ERROR] Validating form access:", error);
    return c.json({ valid: false }, 500);
  }
});

// Submit new request
app.post("/api/requests", zValidator("json", RequestFormSchema), async (c) => {
  try {
    const data = c.req.valid("json");
    const db = c.env.DB;
    
    const protocol = generateProtocol();
    const suggestedPriority = calculateSuggestedPriority(data);
    const priority = data.priorityClassification;
    const sla = await calculateSLA(db, priority);
    const slaDeadline = sla.deadline.toISOString();
    
    console.log("🔵 BEFORE DB INSERT - About to insert request");
    console.log("🔵 Protocol:", protocol);
    console.log("🔵 Priority:", priority);
    
    // Insert request without assigned_validator_id (will be set to NULL)
    const insertResult = await db
      .prepare(
        `INSERT INTO requests (
          protocol, status,
          medical_record_number, patient_name, age, sex, insurance, attending_physician, mvsoul_number, origin,
          clinical_presentation, symptom_duration, primary_diagnosis, differential_diagnosis,
          ecg, troponin, vital_signs, echocardiogram, other_exams, lab_results,
          has_active_infection, infectious_focus, infection_signs, is_non_cardiac_infection, cardiac_justification,
          admission_justification, clinical_risk, risk_justification, inpatient_plan, expected_benefit,
          priority_classification, suggested_priority,
          requesting_physician, crm,
          sla_minutes, sla_deadline
        ) VALUES (
          ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?
        )`
      )
      .bind(
        protocol, "Aguardando validação",
        data.medicalRecordNumber || null, data.patientName, parseInt(data.age), data.sex, data.insurance, 
        data.attendingPhysician, data.mvSoulNumber, data.origin,
        data.clinicalPresentation, data.symptomDuration || null, 
        data.primaryDiagnosis, data.differentialDiagnosis || null,
        data.ecg, data.troponin || '', data.vitalSigns, 
        data.echocardiogram || null, data.otherExams || null, data.labResults || null,
        data.hasActiveInfection, data.infectiousFocus || null, 
        JSON.stringify(data.infectionSigns), null, 
        data.cardiacJustification || null,
        data.admissionJustification, data.clinicalRisk, data.riskJustification || null,
        data.inpatientPlan, data.expectedBenefit,
        priority, suggestedPriority,
        data.requestingPhysician, data.crm,
        sla.minutes, slaDeadline
      )
      .run();
    
    const requestId = (insertResult as any).meta.last_row_id;
    
    console.log("🟢 AFTER DB INSERT - Request inserted successfully");
    console.log("🟢 Request ID:", requestId);
    console.log("🟢 Now fetching ALL active validators to send notifications");
    
    // Fetch ALL active validators
    const validatorsResult = await db
      .prepare("SELECT * FROM validators WHERE is_active = 1")
      .all();
    
    const validators = validatorsResult.results || [];
    console.log(`📋 Found ${validators.length} active validators`);
    
    // Send notification to ALL active validators
    console.log("=== 📨 SENDING NOTIFICATIONS TO ALL VALIDATORS ===");
    console.log("📋 Protocol:", protocol);
    console.log("📋 Patient name:", data.patientName);
    console.log("📋 Priority:", priority);
    console.log("🕐 Timestamp:", new Date().toISOString());
    
    const notificationResults = [];
    
    for (const validator of validators) {
      console.log(`🚀 Sending notification to validator: ${(validator as any).name} (ID: ${(validator as any).id})`);
      
      const diagnostic = await sendValidatorNotification(c.env, (validator as any).id, {
        protocol,
        medicalRecordNumber: data.medicalRecordNumber || '',
        patientName: data.patientName,
        mvSoulNumber: data.mvSoulNumber,
        insurance: data.insurance,
        priority: priority,
        risk: data.clinicalRisk,
        slaMinutes: sla.minutes,
        clinicalPresentation: data.clinicalPresentation,
      });
      
      notificationResults.push({
        validatorId: (validator as any).id,
        validatorName: (validator as any).name,
        ...diagnostic
      });
      
      console.log(`✅ Notification sent to ${(validator as any).name}: ${diagnostic.success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    console.log("=== 📨 ALL NOTIFICATIONS COMPLETED ===");
    console.log(`📊 Total notifications sent: ${notificationResults.length}`);
    console.log(`✅ Successful: ${notificationResults.filter(r => r.success).length}`);
    console.log(`❌ Failed: ${notificationResults.filter(r => !r.success).length}`);
    
    return c.json({
      success: true,
      requestId: requestId,
      protocol,
      status: "Aguardando validação",
      priority: priority,
      suggestedPriority,
      slaMinutes: sla.minutes,
      slaDeadline: slaDeadline,
      notificationsSent: notificationResults.length,
      notificationResults, // Include detailed results for all validators
    });
  } catch (error) {
    console.error("Error creating request:", error);
    return c.json({ success: false, error: "Erro ao criar solicitação" }, 500);
  }
});

// Upload attachment for a request
app.post("/api/requests/:requestId/attachments", async (c) => {
  try {
    const requestId = c.req.param("requestId");
    const db = c.env.DB;
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const uploadedBy = formData.get("uploadedBy") as string || "unknown";

    if (!file) {
      return c.json({ error: "Nenhum arquivo enviado" }, 400);
    }

    // Generate unique key for R2
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const r2Key = `attachments/${requestId}/${timestamp}-${sanitizedFileName}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    // Save metadata to database
    const result: any = await db
      .prepare(`
        INSERT INTO request_attachments 
        (request_id, file_name, file_size, file_type, r2_key, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(requestId, file.name, file.size, file.type, r2Key, uploadedBy)
      .run();

    return c.json({
      success: true,
      attachment: {
        id: result.meta.last_row_id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      },
    });
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return c.json({ error: "Erro ao fazer upload do arquivo" }, 500);
  }
});

// Get attachments for a request
app.get("/api/requests/:requestId/attachments", async (c) => {
  try {
    const requestId = c.req.param("requestId");
    const db = c.env.DB;

    const results = await db
      .prepare("SELECT * FROM request_attachments WHERE request_id = ? ORDER BY created_at DESC")
      .bind(requestId)
      .all();

    return c.json(results.results || []);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    return c.json({ error: "Erro ao buscar anexos" }, 500);
  }
});

// Download attachment
app.get("/api/attachments/:attachmentId", async (c) => {
  try {
    const attachmentId = c.req.param("attachmentId");
    const db = c.env.DB;

    // Get attachment metadata
    const attachment = await db
      .prepare("SELECT * FROM request_attachments WHERE id = ?")
      .bind(attachmentId)
      .first();

    if (!attachment) {
      return c.json({ error: "Anexo não encontrado" }, 404);
    }

    // Get file from R2
    const r2Object = await c.env.R2_BUCKET.get((attachment as any).r2_key);

    if (!r2Object) {
      return c.json({ error: "Arquivo não encontrado no armazenamento" }, 404);
    }

    // Return file with appropriate headers
    const headers = new Headers();
    r2Object.writeHttpMetadata(headers);
    headers.set("etag", r2Object.httpEtag);
    headers.set("Content-Disposition", `inline; filename="${(attachment as any).file_name}"`);

    return c.body(r2Object.body, { headers });
  } catch (error) {
    console.error("Error downloading attachment:", error);
    return c.json({ error: "Erro ao baixar arquivo" }, 500);
  }
});

// Delete attachment
app.delete("/api/attachments/:attachmentId", async (c) => {
  try {
    const attachmentId = c.req.param("attachmentId");
    const db = c.env.DB;

    // Get attachment metadata
    const attachment = await db
      .prepare("SELECT * FROM request_attachments WHERE id = ?")
      .bind(attachmentId)
      .first();

    if (!attachment) {
      return c.json({ error: "Anexo não encontrado" }, 404);
    }

    // Delete from R2
    await c.env.R2_BUCKET.delete((attachment as any).r2_key);

    // Delete from database
    await db
      .prepare("DELETE FROM request_attachments WHERE id = ?")
      .bind(attachmentId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return c.json({ error: "Erro ao deletar arquivo" }, 500);
  }
});

// Get all pending requests
app.get("/api/requests", async (c) => {
  try {
    const db = c.env.DB;
    
    const results = await db
      .prepare(`
        SELECT * FROM requests 
        WHERE LOWER(status) LIKE '%aguardando%' OR LOWER(status) = 'enviada'
        ORDER BY 
          CASE LOWER(priority_classification)
            WHEN 'imediata' THEN 1 
            WHEN 'urgente' THEN 2 
            WHEN 'eletiva' THEN 3 
          END,
          created_at ASC
      `)
      .all();
    
    return c.json(results.results || []);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return c.json({ error: "Erro ao buscar solicitações" }, 500);
  }
});

// Get request by protocol
app.get("/api/requests/:protocol", async (c) => {
  try {
    const protocol = c.req.param("protocol");
    const db = c.env.DB;
    
    const result = await db
      .prepare("SELECT * FROM requests WHERE protocol = ?")
      .bind(protocol)
      .first();
    
    if (!result) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Error fetching request:", error);
    return c.json({ error: "Erro ao buscar solicitação" }, 500);
  }
});

// Resend notifications for a request
app.post("/api/requests/:protocol/resend-notifications", async (c) => {
  try {
    const protocol = c.req.param("protocol");
    const db = c.env.DB;
    
    // Get request details
    const request = await db
      .prepare("SELECT * FROM requests WHERE protocol = ?")
      .bind(protocol)
      .first();
    
    if (!request) {
      return c.json({ success: false, error: "Solicitação não encontrada" }, 404);
    }
    
    // Get all active validators
    const validators = await db
      .prepare("SELECT * FROM validators WHERE is_active = 1")
      .all();
    
    if (!validators.results || validators.results.length === 0) {
      return c.json({ success: false, error: "Nenhum validador ativo encontrado" }, 400);
    }
    
    // Calculate SLA
    const priority = (request as any).priority_classification;
    const sla = await calculateSLA(db, priority);
    
    // Send notifications to all validators
    const notificationResults = [];
    
    for (const validator of validators.results) {
      console.log(`🔄 Resending notification to validator: ${(validator as any).name}`);
      
      const diagnostic = await sendValidatorNotification(c.env, (validator as any).id, {
        protocol: (request as any).protocol,
        medicalRecordNumber: (request as any).medical_record_number || '',
        patientName: (request as any).patient_name,
        mvSoulNumber: (request as any).mvsoul_number,
        insurance: (request as any).insurance,
        priority: priority,
        risk: (request as any).clinical_risk,
        slaMinutes: sla.minutes,
        clinicalPresentation: (request as any).clinical_presentation,
      });
      
      notificationResults.push({
        validatorId: (validator as any).id,
        validatorName: (validator as any).name,
        ...diagnostic
      });
    }
    
    return c.json({
      success: true,
      message: "Notificações reenviadas",
      notificationsSent: notificationResults.length,
      notificationResults,
    });
  } catch (error) {
    console.error("Error resending notifications:", error);
    return c.json({ success: false, error: "Erro ao reenviar notificações" }, 500);
  }
});

// Submit validator decision
app.post("/api/requests/:protocol/decision", zValidator("json", ValidatorDecisionSchema), async (c) => {
  try {
    const protocol = c.req.param("protocol");
    const data = c.req.valid("json");
    const db = c.env.DB;
    
    console.log(`[DECISION ENDPOINT] Called for protocol: ${protocol}, decision: ${data.decision}`);
    
    // Validate justification is required for "negada" decision
    if (data.decision === "negada" && !data.decisionJustification) {
      return c.json({ error: "Justificativa é obrigatória para negar a solicitação" }, 400);
    }
    
    // Check if request exists
    const request = await db
      .prepare("SELECT * FROM requests WHERE protocol = ?")
      .bind(protocol)
      .first();
    
    if (!request) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }
    
    // Map decision to status
    let status = data.decision;
    if (data.decision === "aprovada_com_observacao") {
      status = "aprovada";
    }
    
    // Update request with decision
    await db
      .prepare(
        `UPDATE requests 
         SET status = ?,
             validator_physician = ?,
             validator_crm = ?,
             decision = ?,
             decision_justification = ?,
             decision_observation = ?,
             decision_at = ?,
             updated_at = ?
         WHERE protocol = ?`
      )
      .bind(
        status,
        data.validatorPhysician,
        data.validatorCrm,
        data.decision,
        data.decisionJustification || null,
        data.decisionObservation || null,
        new Date().toISOString(),
        new Date().toISOString(),
        protocol
      )
      .run();
    
    // Update Telegram messages for all validators who were notified
    console.log(`[TELEGRAM UPDATE] Starting Telegram message update for protocol ${protocol}`);
    try {
      // Get Telegram bot token
      const telegramSetting = await db
        .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
        .first();
      
      console.log(`[TELEGRAM UPDATE] Bot token found: ${telegramSetting?.setting_value ? 'YES' : 'NO'}`);
      
      if (telegramSetting?.setting_value) {
        const botToken = telegramSetting.setting_value as string;
        
        // Get all Telegram notifications sent for this request
        // Use LEFT JOIN to ensure we get notifications even if validator was deleted
        const notifications = await db
          .prepare(
            `SELECT nl.*, v.name as validator_name 
             FROM notification_log nl
             LEFT JOIN validators v ON nl.validator_id = v.id
             WHERE nl.request_protocol = ? 
             AND nl.channel = 'telegram' 
             AND nl.status = 'sent'
             AND nl.telegram_message_id IS NOT NULL`
          )
          .bind(protocol)
          .all();
        
        console.log(`[TELEGRAM UPDATE] Found ${notifications.results?.length || 0} Telegram notifications for protocol ${protocol}`);
        
        // Update each Telegram message
        for (const notification of notifications.results as any[]) {
          try {
            console.log(`[TELEGRAM UPDATE] Updating message_id=${notification.telegram_message_id} for chat_id=${notification.recipient}`);
            
            const decisionEmoji = data.decision === "aprovada" || data.decision === "aprovada_com_observacao" ? "✅" : "❌";
            const decisionText = data.decision === "aprovada" ? "Aprovada" : 
                                data.decision === "aprovada_com_observacao" ? "Aprovada com Observação" : "Negada";
            
            // Update the message to remove buttons and add decision
            const updateResponse = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: notification.recipient,
                message_id: parseInt(notification.telegram_message_id),
                text: `${decisionEmoji} <b>Solicitação ${decisionText}</b>\n\n<b>Validada por:</b> ${data.validatorPhysician} (via Web)\n<b>Protocolo:</b> ${protocol}`,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [] }, // Remove buttons
              }),
            });
            
            const updateResult = await updateResponse.json() as any;
            
            if (updateResult.ok) {
              console.log(`✅ [TELEGRAM UPDATE] Successfully updated message for validator ${notification.validator_name || notification.validator_id}`);
            } else {
              console.error(`❌ [TELEGRAM UPDATE] Failed to update message: ${updateResult.description}`);
              console.error(`[TELEGRAM UPDATE] Error code: ${updateResult.error_code}, chat_id: ${notification.recipient}, message_id: ${notification.telegram_message_id}`);
            }
          } catch (error) {
            console.error(`❌ [TELEGRAM UPDATE] Exception updating message for validator ${notification.validator_id}:`, error);
          }
        }
        
        // If approved, send notification to nurses and requesters
        console.log(`[DECISION CHECK] Checking if approval: decision=${data.decision}`);
        if (data.decision === "aprovada" || data.decision === "aprovada_com_observacao") {
          console.log(`[WEB APPROVAL] ✅ Calling shared notification function`);
          
          // Call shared notification function
          await sendApprovalNotifications(db, botToken, protocol, request, data.validatorPhysician);
        }
      }
    } catch (error) {
      console.error("Error updating Telegram messages:", error);
      // Don't fail the request if Telegram update fails
    }
    
    return c.json({
      success: true,
      protocol,
      status,
      decision: data.decision,
      diagnostic: getDiagnostic(protocol),
    });
  } catch (error) {
    console.error("Error submitting decision:", error);
    return c.json({ error: "Erro ao registrar decisão" }, 500);
  }
});

// MVSOUL Integration - Proxy endpoint to avoid CORS issues
app.get("/api/mvsoul/patient/:atendimento", async (c) => {
  const diagnosticLog: string[] = [];
  
  try {
    const atendimento = c.req.param("atendimento");
    const db = c.env.DB;
    
    diagnosticLog.push(`[1] Recebido atendimento: ${atendimento}`);
    
    if (!atendimento) {
      return c.json({ error: "Número de atendimento é obrigatório", diagnostic: diagnosticLog }, 400);
    }
    
    // Get MVSOUL credentials from settings
    diagnosticLog.push("[2] Buscando credenciais no banco de dados...");
    const userResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_user").first();
    const passwordResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_password").first();
    const urlResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_url").first();
    
    const apiUser = userResult?.setting_value as string || "";
    const apiPassword = passwordResult?.setting_value as string || "";
    const apiUrl = urlResult?.setting_value as string || "https://rede.hospitalprontocardio.com.br:9058/";
    
    diagnosticLog.push(`[3] URL da API: ${apiUrl}`);
    diagnosticLog.push(`[4] Usuário configurado: ${apiUser ? 'SIM' : 'NÃO'}`);
    diagnosticLog.push(`[5] Senha configurada: ${apiPassword ? 'SIM' : 'NÃO'}`);
    
    if (!apiUser || !apiPassword) {
      return c.json({ 
        error: "Credenciais da API do MVSOUL não configuradas. Configure nas Configurações do Sistema.",
        diagnostic: diagnosticLog
      }, 400);
    }
    
    // Step 1: Get authentication token from MVSOUL API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      // Authenticate and get token
      const authUrl = `${apiUrl}api/auth/token/`;
      diagnosticLog.push(`[6] Tentando autenticação em: ${authUrl}`);
      
      const authResponse = await fetch(
        authUrl,
        { 
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            username: apiUser,
            password: apiPassword
          })
        }
      );
      
      diagnosticLog.push(`[7] Resposta da autenticação: ${authResponse.status} ${authResponse.statusText}`);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        diagnosticLog.push(`[8] Erro de autenticação: ${errorText.substring(0, 200)}`);
        console.error(`MVSOUL Auth error (${authResponse.status}):`, errorText);
        return c.json({ 
          error: "Falha na autenticação com MVSOUL. Verifique usuário e senha nas configurações.",
          diagnostic: diagnosticLog
        }, 401);
      }
      
      const authData = await authResponse.json() as any;
      const accessToken = authData.access;
      
      diagnosticLog.push(`[8] Token recebido: ${accessToken ? 'SIM' : 'NÃO'}`);
      
      if (!accessToken) {
        return c.json({ 
          error: "Token de acesso não recebido da API do MVSOUL",
          diagnostic: diagnosticLog
        }, 500);
      }
      
      // Step 2: Fetch patient data using the token
      const patientUrl = `${apiUrl}api/atend-ndir/${atendimento}`;
      diagnosticLog.push(`[9] Buscando dados do paciente em: ${patientUrl}`);
      
      const response = await fetch(
        patientUrl,
        { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      diagnosticLog.push(`[10] Resposta dos dados: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        diagnosticLog.push(`[11] Erro ao buscar dados: ${errorText.substring(0, 200)}`);
        console.error(`MVSOUL API error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          return c.json({ 
            error: "Atendimento não encontrado na API do MVSOUL",
            diagnostic: diagnosticLog
          }, 404);
        }
        
        return c.json({ 
          error: `Erro na API do MVSOUL: ${response.status}`,
          diagnostic: diagnosticLog
        }, 500);
      }
      
      const data = await response.json() as any;
      diagnosticLog.push(`[11] Dados recebidos com sucesso. Campos: ${Object.keys(data).join(', ')}`);
      
      // Step 3: Fetch evolutions for this specific attendance (cd_atendimento)
      // We'll get the doctor name (nm_prestador) from the FIRST evolution
      // and the evolution text (DS_EVOLUCAO) from the LAST evolution
      let firstEvolution = null;
      let lastEvolution = null;
      // Use ONLY patient ID to get ALL evolutions for this patient across all attendances
      const cd_atendimento = data.cd_atendimento || atendimento;
      const cd_paciente = data.cd_paciente;
      diagnosticLog.push(`[12] cd_atendimento: ${cd_atendimento}, cd_paciente: ${cd_paciente}. Buscando evoluções...`);
      
      try {
        // Query by paciente_id ONLY to get ALL evolutions for this patient
        // This allows us to find the first evolution (oldest) for doctor name
        // and the last evolution (most recent) for clinical presentation
        let evolutionUrl = `${apiUrl}api/evolucao/?paciente_id=${cd_paciente}`;
        diagnosticLog.push(`[13] Buscando evoluções em: ${evolutionUrl}`);
          
          const evolutionResponse = await fetch(
            evolutionUrl,
            { 
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );
          
          diagnosticLog.push(`[14] Resposta da evolução: ${evolutionResponse.status} ${evolutionResponse.statusText}`);
          
          if (evolutionResponse.ok) {
            const evolutionData = await evolutionResponse.json() as any;
            
            // Check if evolutionData has results array (paginated response)
            const allResults = evolutionData.results || evolutionData;
            
            if (Array.isArray(allResults) && allResults.length > 0) {
              diagnosticLog.push(`[15] Evoluções retornadas da API. Total: ${allResults.length}`);
              
              // Filter evolutions to only include those for this specific patient
              // API may not properly filter, so we do it client-side
              const patientId = cd_paciente?.toString();
              const results = allResults.filter((ev: any) => {
                const evPatientId = (ev.CD_PACIENTE || ev.cd_paciente)?.toString();
                return evPatientId === patientId;
              });
              
              diagnosticLog.push(`[15b] Evoluções filtradas para paciente ${patientId}: ${results.length}`);
              
              if (results.length > 0) {
                // Sort evolutions by date AND time (oldest first)
                // Combine DT_PRE_MED with HR_PRE_MED for proper chronological ordering
                const sortedResults = [...results].sort((a, b) => {
                  const dateA = `${a.DT_PRE_MED || a.dt_pre_med || ''}T${a.HR_PRE_MED || a.hr_pre_med || '00:00:00'}`;
                  const dateB = `${b.DT_PRE_MED || b.dt_pre_med || ''}T${b.HR_PRE_MED || b.hr_pre_med || '00:00:00'}`;
                  return new Date(dateA).getTime() - new Date(dateB).getTime();
                });
                
                // Get the FIRST evolution chronologically (for doctor's name)
                firstEvolution = sortedResults[0] || null;
                // Get the LAST evolution chronologically (for clinical presentation)
                lastEvolution = sortedResults[sortedResults.length - 1] || null;
                
                diagnosticLog.push(`[15a] Evoluções ordenadas por data+hora. Primeira: ${firstEvolution?.DT_PRE_MED} ${firstEvolution?.HR_PRE_MED}, Última: ${lastEvolution?.DT_PRE_MED} ${lastEvolution?.HR_PRE_MED}`);
                
                // Get doctor name from first evolution
                let doctorName = null;
                
                // 1. Try NM_PRESTADOR from first evolution (doctor's name directly)
                const nmPrestador = firstEvolution.NM_PRESTADOR || firstEvolution.nm_prestador;
                const nmUsuario = firstEvolution.NM_USUARIO || firstEvolution.nm_usuario;
                diagnosticLog.push(`[16] Primeira evolução - NM_PRESTADOR: ${nmPrestador || 'não encontrado'}, NM_USUARIO: ${nmUsuario || 'não encontrado'}`);
                
                if (nmPrestador) {
                  doctorName = nmPrestador;
                  diagnosticLog.push(`[16a] Médico obtido de NM_PRESTADOR: "${doctorName}"`);
                } else if (nmUsuario) {
                  doctorName = nmUsuario;
                  diagnosticLog.push(`[16a] Médico obtido de NM_USUARIO: "${doctorName}"`);
                }
                
                if (doctorName) {
                  firstEvolution._normalized_doctor = doctorName;
                } else {
                  diagnosticLog.push(`[16a] NM_PRESTADOR e NM_USUARIO não encontrados na primeira evolução`);
                }
                
                const lastEvolutionText = lastEvolution.ds_evolucao || lastEvolution.DS_EVOLUCAO;
                // Combine date and time for last evolution
                const lastEvolutionDateOnly = lastEvolution.DT_PRE_MED || lastEvolution.dt_pre_med;
                const lastEvolutionTime = lastEvolution.HR_PRE_MED || lastEvolution.hr_pre_med;
                // Also check for hr_atendimento which has full datetime
                const hrAtendimento = lastEvolution.HR_ATENDIMENTO || lastEvolution.hr_atendimento;
                
                // Prefer hr_atendimento if available (full datetime), otherwise combine date+time
                let lastEvolutionDate = hrAtendimento;
                if (!lastEvolutionDate && lastEvolutionDateOnly) {
                  if (lastEvolutionTime) {
                    // Format: "2026-05-26" + "11:08:21" = "2026-05-26T11:08:21"
                    const timeClean = lastEvolutionTime.split('.')[0]; // Remove milliseconds if present
                    lastEvolutionDate = `${lastEvolutionDateOnly}T${timeClean}`;
                  } else {
                    lastEvolutionDate = lastEvolutionDateOnly;
                  }
                }
                
                diagnosticLog.push(`[17] Última evolução - Data: ${lastEvolutionDateOnly}, Hora: ${lastEvolutionTime}, HR_ATENDIMENTO: ${hrAtendimento}, Combinado: ${lastEvolutionDate}`);
                diagnosticLog.push(`[18] Última evolução (ds_evolucao): ${lastEvolutionText ? 'SIM' : 'NÃO'}`);
                diagnosticLog.push(`[19] Conteúdo ds_evolucao (primeiros 100 chars): ${lastEvolutionText ? lastEvolutionText.substring(0, 100) : 'vazio'}`);
                
                // Store normalized values for return
                lastEvolution._normalized_text = lastEvolutionText;
                lastEvolution._normalized_date = lastEvolutionDate;
              } else {
                diagnosticLog.push(`[15c] Nenhuma evolução encontrada para o paciente ${patientId} após filtro`);
              }
            } else {
              diagnosticLog.push(`[15] Nenhuma evolução encontrada para o atendimento`);
            }
          } else {
            diagnosticLog.push(`[14] Erro ao buscar evolução: ${evolutionResponse.status}`);
          }
        } catch (evolutionError: any) {
          diagnosticLog.push(`[ERRO] Erro ao buscar evolução: ${evolutionError.message}`);
          console.error("Error fetching evolution:", evolutionError);
          // Don't fail the whole request if evolution fetch fails
        }
      
      return c.json({ 
        ...data,
        // Doctor name extracted from FIRST evolution's DS_EVOLUCAO text
        nm_prestador_evolucao: firstEvolution?._normalized_doctor || null,
        // Evolution text from LAST evolution
        ds_evolucao: lastEvolution?._normalized_text || lastEvolution?.ds_evolucao || lastEvolution?.DS_EVOLUCAO || null,
        dt_pre_med: lastEvolution?._normalized_date || lastEvolution?.dt_pre_med || lastEvolution?.DT_PRE_MED || null,
        _diagnostic: diagnosticLog 
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        diagnosticLog.push("[ERRO] Timeout - API demorou mais de 30 segundos");
        console.error("MVSOUL API timeout");
        return c.json({ 
          error: "A API do MVSOUL demorou muito para responder. Tente novamente.",
          diagnostic: diagnosticLog
        }, 504);
      }
      
      diagnosticLog.push(`[ERRO] Exceção durante requisição: ${fetchError.message}`);
      throw fetchError;
    }
  } catch (error: any) {
    diagnosticLog.push(`[ERRO FATAL] ${error?.message || 'Unknown error'}`);
    console.error("Error fetching patient from MVSOUL:", error);
    return c.json({ 
      error: "Erro ao conectar com a API do MVSOUL. Verifique se o serviço está disponível.",
      details: error?.message || 'Unknown error',
      diagnostic: diagnosticLog
    }, 500);
  }
});

// MVSOUL Laudo endpoints
app.get("/api/mvsoul/laudo", async (c) => {
  try {
    const pacienteId = c.req.query("paciente_id");
    const db = c.env.DB;
    
    if (!pacienteId) {
      return c.json({ error: "paciente_id é obrigatório" }, 400);
    }
    
    // Get MVSOUL credentials from settings
    const userResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_user").first();
    const passwordResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_password").first();
    const urlResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_url").first();
    
    const apiUser = userResult?.setting_value as string || "";
    const apiPassword = passwordResult?.setting_value as string || "";
    const apiUrl = urlResult?.setting_value as string || "https://rede.hospitalprontocardio.com.br:9058/";
    
    if (!apiUser || !apiPassword) {
      return c.json({ error: "Credenciais da API do MVSOUL não configuradas" }, 400);
    }
    
    // Authenticate
    const authResponse = await fetch(
      `${apiUrl}api/auth/token/`,
      { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: apiUser,
          password: apiPassword
        })
      }
    );
    
    if (!authResponse.ok) {
      return c.json({ error: "Falha na autenticação MVSOUL" }, 500);
    }
    
    const authData = await authResponse.json() as any;
    const accessToken = authData.access;
    
    // Fetch laudos
    const laudoResponse = await fetch(
      `${apiUrl}api/laudo/?paciente_id=${pacienteId}`,
      { 
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!laudoResponse.ok) {
      return c.json({ error: "Erro ao buscar laudos" }, 500);
    }
    
    const laudoData = await laudoResponse.json() as any;
    
    // Log the structure to understand what fields are available
    if (laudoData.results && laudoData.results.length > 0) {
      console.log("[LAUDO API] Sample laudo fields:", Object.keys(laudoData.results[0]));
      // Check for RTF/TXT fields
      const firstLaudo = laudoData.results[0];
      if (firstLaudo.ds_laudo_rtf) {
        console.log("[LAUDO API] Has ds_laudo_rtf field (RTF format)");
      }
      if (firstLaudo.ds_laudo_txt) {
        console.log("[LAUDO API] Has ds_laudo_txt field (TXT format)");
      }
    }
    
    return c.json(laudoData);
  } catch (error) {
    console.error("Error fetching laudos:", error);
    return c.json({ error: "Erro ao buscar laudos" }, 500);
  }
});

// Get laudo text content (RTF/TXT) by ID
app.get("/api/mvsoul/laudo/:id/text", async (c) => {
  try {
    const idExamePedido = c.req.param("id");
    const db = c.env.DB;
    
    console.log(`[LAUDO TEXT] Fetching text content for exam ID: ${idExamePedido}`);
    
    // Get MVSOUL credentials from settings
    const userResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_user").first();
    const passwordResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_password").first();
    const urlResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_url").first();
    
    const apiUser = userResult?.setting_value as string || "";
    const apiPassword = passwordResult?.setting_value as string || "";
    const apiUrl = urlResult?.setting_value as string || "https://rede.hospitalprontocardio.com.br:9058/";
    
    if (!apiUser || !apiPassword) {
      return c.json({ error: "Credenciais da API do MVSOUL não configuradas" }, 400);
    }
    
    // Authenticate
    const authResponse = await fetch(
      `${apiUrl}api/auth/token/`,
      { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: apiUser,
          password: apiPassword
        })
      }
    );
    
    if (!authResponse.ok) {
      return c.json({ error: "Falha na autenticação MVSOUL" }, 500);
    }
    
    const authData = await authResponse.json() as any;
    const accessToken = authData.access;
    
    // Fetch the specific laudo to get RTF/TXT content
    const laudoResponse = await fetch(
      `${apiUrl}api/laudo/${idExamePedido}/`,
      { 
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!laudoResponse.ok) {
      console.log(`[LAUDO TEXT] API returned error: ${laudoResponse.status}`);
      return c.json({ error: "Erro ao buscar laudo" }, 500);
    }
    
    const laudoData = await laudoResponse.json() as any;
    
    console.log(`[LAUDO TEXT] Laudo data received:`, JSON.stringify(laudoData).substring(0, 500));
    console.log(`[LAUDO TEXT] Laudo data keys:`, Object.keys(laudoData));
    console.log(`[LAUDO TEXT] Has RTF:`, !!laudoData.ds_laudo_rtf);
    console.log(`[LAUDO TEXT] Has TXT:`, !!laudoData.ds_laudo_txt);
    
    // Check if RTF or TXT content is available
    const rtfContent = laudoData.ds_laudo_rtf;
    const txtContent = laudoData.ds_laudo_txt;
    
    if (rtfContent) {
      console.log(`[LAUDO TEXT] RTF content length:`, rtfContent.length);
      console.log(`[LAUDO TEXT] RTF preview:`, rtfContent.substring(0, 100));
    }
    
    if (txtContent) {
      console.log(`[LAUDO TEXT] TXT content length:`, txtContent.length);
      console.log(`[LAUDO TEXT] TXT preview:`, txtContent.substring(0, 100));
    }
    
    // If no text content is available, return an informative error
    if (!rtfContent && !txtContent) {
      console.log(`[LAUDO TEXT] No RTF or TXT content available for this laudo`);
      return c.json({
        error: "no_text_content",
        message: "Este laudo não possui conteúdo em formato texto",
        id_exame_pedido: idExamePedido,
        has_rtf: false,
        has_txt: false
      }, 404);
    }
    
    // Return both RTF and TXT content if available
    return c.json({
      id_exame_pedido: idExamePedido,
      nome_exa_rx: laudoData.nome_exa_rx,
      dt_laudo: laudoData.dt_laudo,
      ds_laudo_rtf: rtfContent || null,
      ds_laudo_txt: txtContent || null,
      has_rtf: !!rtfContent,
      has_txt: !!txtContent,
      has_pdf: false,
      format: rtfContent ? 'rtf' : 'txt'
    });
    
  } catch (error) {
    console.error("[LAUDO TEXT] Error:", error);
    return c.json({ error: "Erro ao buscar texto do laudo" }, 500);
  }
});

app.get("/api/mvsoul/laudo/pdf/:id", async (c) => {
  try {
    const idExamePedido = c.req.param("id");
    const db = c.env.DB;
    const timestamp = Date.now();
    
    // R2 key for caching the PDF
    const r2Key = `laudos/erp-${idExamePedido}-${timestamp}.pdf`;
    // Also try to find existing cached version (without timestamp)
    const r2KeyPrefix = `laudos/erp-${idExamePedido}-`;
    
    console.log(`[PDF] Attempting to fetch laudo PDF for exam ID: ${idExamePedido}`);
    
    // Step 1: Try to get from R2 cache first
    try {
      // List objects with the prefix to find any existing cached version
      const listed = await c.env.R2_BUCKET.list({ prefix: r2KeyPrefix });
      
      if (listed.objects && listed.objects.length > 0) {
        // Get the first matching object (most recent or only one)
        const cachedKey = listed.objects[0].key;
        const cachedObject = await c.env.R2_BUCKET.get(cachedKey);
        
        if (cachedObject && cachedObject.size > 0) {
          console.log(`[PDF] Found in R2: ${cachedKey} (${Math.round(cachedObject.size / 1024)} KB)`);
          const pdfBuffer = await cachedObject.arrayBuffer();
          
          return new Response(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'inline',
              'Content-Length': cachedObject.size.toString()
            }
          });
        }
      }
    } catch (r2Error) {
      console.log(`[PDF] R2 cache miss or error, will try MVSOUL fallback:`, r2Error);
    }
    
    // Step 2: Fallback to MVSOUL API
    console.log(`[PDF] Attempting MVSOUL fallback for exam ID: ${idExamePedido}`);
    
    // Get MVSOUL credentials from settings
    const userResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_user").first();
    const passwordResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_password").first();
    const urlResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_url").first();
    
    const apiUser = userResult?.setting_value as string || "";
    const apiPassword = passwordResult?.setting_value as string || "";
    const apiUrl = urlResult?.setting_value as string || "https://rede.hospitalprontocardio.com.br:9058/";
    
    if (!apiUser || !apiPassword) {
      console.log(`[PDF] MVSOUL credentials not configured`);
      return c.json({ error: "Credenciais da API do MVSOUL não configuradas" }, 400);
    }
    
    // Authenticate
    const authResponse = await fetch(
      `${apiUrl}api/auth/token/`,
      { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: apiUser,
          password: apiPassword
        })
      }
    );
    
    if (!authResponse.ok) {
      console.log(`[PDF] MVSOUL authentication failed`);
      return c.json({ error: "Falha na autenticação MVSOUL" }, 500);
    }
    
    const authData = await authResponse.json() as any;
    const accessToken = authData.access;
    
    // Fetch PDF from MVSOUL using the same endpoint as the other working project
    console.log(`[PDF] Fetching from MVSOUL: ${apiUrl}api/pacs/${idExamePedido}/pdf/`);
    
    const pdfResponse = await fetch(
      `${apiUrl}api/pacs/${idExamePedido}/pdf/`,
      { 
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!pdfResponse.ok) {
      console.log(`[PDF] MVSOUL API returned error: ${pdfResponse.status}`);
      return c.json({ error: "Erro ao buscar PDF do laudo" }, 500);
    }
    
    // The /api/pacs/{id}/pdf/ endpoint returns binary PDF directly
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log(`[PDF] Downloaded from MVSOUL: ${Math.round(pdfBuffer.byteLength / 1024)} KB`);
    
    // Validate PDF is not empty
    if (pdfBuffer.byteLength === 0) {
      console.log(`[PDF] PDF is empty (0 bytes)`);
      return c.json({ error: "PDF vazio recebido" }, 500);
    }
    
    // Validate that it's actually a PDF or text content
    const pdfBytes = new Uint8Array(pdfBuffer);
    
    // Try to decode as text first to check for CLOB/RTF content
    const textPreview = new TextDecoder('utf-8').decode(pdfBytes.slice(0, 500));
    console.log(`[PDF] First 500 bytes preview:`, textPreview.substring(0, 100));
    
    // Check if this is RTF, plain text, or other text-based content
    const isRtf = textPreview.includes('{\\rtf') || textPreview.includes('\\rtf1');
    const isPlainText = /^[\x20-\x7E\s]+/.test(textPreview.substring(0, 100)) && !textPreview.startsWith('%PDF');
    
    if (isRtf || isPlainText) {
      console.log(`[PDF] Content is text-based (RTF or plain text), not PDF binary`);
      return c.json({ 
        error: "not_pdf",
        format: isRtf ? "rtf" : "text",
        message: "Este laudo está em formato de texto, não PDF"
      }, 400);
    }
    
    // Now check for valid PDF header
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    console.log(`[PDF] First 5 bytes as string: "${header}"`);
    console.log(`[PDF] First 20 bytes as hex:`, Array.from(pdfBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    if (!header.startsWith('%PDF')) {
      console.log(`[PDF] Invalid PDF header - not a valid PDF file`);
      return c.json({ 
        error: "invalid_pdf",
        details: `Cabeçalho recebido: ${header}`,
        preview: textPreview.substring(0, 100)
      }, 500);
    }
    
    console.log(`[PDF] Valid PDF header detected ✓`);
    
    // Step 3: Cache to R2 for next time
    try {
      await c.env.R2_BUCKET.put(r2Key, pdfBuffer, {
        httpMetadata: {
          contentType: 'application/pdf'
        }
      });
      console.log(`[PDF] Cached to R2 successfully: ${r2Key}`);
    } catch (cacheError) {
      console.log(`[PDF] Failed to cache to R2 (non-fatal):`, cacheError);
      // Continue anyway - we can still return the PDF even if caching failed
    }
    
    // Return the PDF
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Content-Length': pdfBuffer.byteLength.toString()
      }
    });
    
  } catch (error) {
    console.error("[PDF] Error fetching laudo PDF:", error);
    return c.json({ error: "Erro ao buscar PDF do laudo" }, 500);
  }
});

app.get("/api/mvsoul/pacs/:id/visualizador", async (c) => {
  try {
    const idExamePedido = c.req.param("id");
    const db = c.env.DB;
    
    // Get MVSOUL credentials from settings
    const userResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_user").first();
    const passwordResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_password").first();
    const urlResult = await db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").bind("mvsoul_api_url").first();
    
    const apiUser = userResult?.setting_value as string || "";
    const apiPassword = passwordResult?.setting_value as string || "";
    const apiUrl = urlResult?.setting_value as string || "https://rede.hospitalprontocardio.com.br:9058/";
    
    if (!apiUser || !apiPassword) {
      return c.json({ error: "Credenciais da API do MVSOUL não configuradas" }, 400);
    }
    
    // Authenticate
    const authResponse = await fetch(
      `${apiUrl}api/auth/token/`,
      { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: apiUser,
          password: apiPassword
        })
      }
    );
    
    if (!authResponse.ok) {
      return c.json({ error: "Falha na autenticação MVSOUL" }, 500);
    }
    
    const authData = await authResponse.json() as any;
    const accessToken = authData.access;
    
    // Fetch visualizador link
    const visualizadorResponse = await fetch(
      `${apiUrl}api/pacs/${idExamePedido}/visualizador/`,
      { 
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!visualizadorResponse.ok) {
      return c.json({ error: "Erro ao buscar visualizador" }, 500);
    }
    
    const visualizadorData = await visualizadorResponse.json() as any;
    return c.json(visualizadorData);
  } catch (error) {
    console.error("Error fetching visualizador:", error);
    return c.json({ error: "Erro ao buscar visualizador" }, 500);
  }
});

// Validator management endpoints
// Public endpoint for request form - returns only active validators with minimal data
app.get("/api/validators/active", async (c) => {
  try {
    const db = c.env.DB;
    
    const validators = await db
      .prepare("SELECT id, name, crm FROM validators WHERE is_active = 1 ORDER BY name ASC")
      .all();
    
    return c.json({ validators: validators.results || [] });
  } catch (error) {
    console.error("Error fetching active validators:", error);
    return c.json({ error: "Erro ao buscar validadores" }, 500);
  }
});

// Protected endpoint for admin - returns all validators with full data
app.get("/api/validators", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    const validators = await db
      .prepare("SELECT * FROM validators ORDER BY name ASC")
      .all();
    
    return c.json(validators.results || []);
  } catch (error) {
    console.error("Error fetching validators:", error);
    return c.json({ error: "Erro ao buscar validadores" }, 500);
  }
});

app.post("/api/validators", authMiddleware, async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `INSERT INTO validators (name, crm, email, phone, is_active, notification_email)
         VALUES (?, ?, ?, ?, 1, 1)`
      )
      .bind(data.name, data.crm, data.email, data.phone || null)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error adding validator:", error);
    return c.json({ error: "Erro ao adicionar validador" }, 500);
  }
});

app.put("/api/validators/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `UPDATE validators 
         SET name = ?, crm = ?, email = ?, phone = ?, telegram_chat_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        data.name,
        data.crm,
        data.email,
        data.phone || null,
        data.telegram_chat_id || null,
        new Date().toISOString(),
        id
      )
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating validator:", error);
    return c.json({ error: "Failed to update validator" }, 500);
  }
});

app.patch("/api/validators/:id/toggle", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    // Toggle active status
    await db
      .prepare("UPDATE validators SET is_active = NOT is_active, updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling validator:", error);
    return c.json({ error: "Erro ao atualizar validador" }, 500);
  }
});

app.post("/api/requests/:protocol/resend-notification", authMiddleware, async (c) => {
  try {
    const protocol = c.req.param("protocol");
    
    console.log("=== RESEND NOTIFICATION ENDPOINT ===");
    console.log("Protocol:", protocol);
    
    const db = c.env.DB;
    
    // Get request data
    const request = await db
      .prepare("SELECT * FROM requests WHERE protocol = ?")
      .bind(protocol)
      .first() as any;
    
    console.log("Request found:", request ? "YES" : "NO");
    console.log("Assigned validator ID:", request?.assigned_validator_id);
    
    if (!request) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }
    
    if (!request.assigned_validator_id) {
      return c.json({ error: "Nenhum validador atribuído a esta solicitação" }, 400);
    }
    
    // Resend notification
    console.log("Calling sendValidatorNotification from resend endpoint...");
    await sendValidatorNotification(c.env, Number(request.assigned_validator_id), {
      protocol: request.protocol,
      medicalRecordNumber: request.medical_record_number || '',
      patientName: request.patient_name,
      mvSoulNumber: request.mvsoul_number,
      insurance: request.insurance,
      priority: request.priority_classification,
      risk: request.clinical_risk,
      slaMinutes: request.sla_minutes,
      clinicalPresentation: request.clinical_presentation,
    });
    console.log("sendValidatorNotification completed");
    
    return c.json({ success: true, message: "Notificação reenviada com sucesso" });
  } catch (error) {
    console.error("Error resending notification:", error);
    return c.json({ error: "Erro ao reenviar notificação" }, 500);
  }
});

app.patch("/api/validators/:id/notification/:channel", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const channel = c.req.param("channel");
    const db = c.env.DB;
    
    const fieldMap: Record<string, string> = {
      email: "notification_email",
      whatsapp: "notification_whatsapp",
      telegram: "notification_telegram",
    };
    
    const field = fieldMap[channel];
    if (!field) {
      return c.json({ error: "Canal inválido" }, 400);
    }
    
    // Toggle notification setting
    await db
      .prepare(`UPDATE validators SET ${field} = NOT ${field}, updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling notification:", error);
    return c.json({ error: "Erro ao atualizar notificação" }, 500);
  }
});

app.delete("/api/validators/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    await db
      .prepare("DELETE FROM validators WHERE id = ?")
      .bind(id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting validator:", error);
    return c.json({ error: "Erro ao deletar validador" }, 500);
  }
});

// Nurses management endpoints
app.get("/api/nurses", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    const nurses = await db
      .prepare("SELECT * FROM nurses ORDER BY name ASC")
      .all();
    
    return c.json(nurses.results || []);
  } catch (error) {
    console.error("Error fetching nurses:", error);
    return c.json({ error: "Erro ao buscar enfermeiros" }, 500);
  }
});

app.post("/api/nurses", authMiddleware, async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `INSERT INTO nurses (name, coren, email, phone, telegram_chat_id, is_active, notification_email, notification_whatsapp, notification_telegram)
         VALUES (?, ?, ?, ?, ?, 1, 1, 0, 0)`
      )
      .bind(data.name, data.coren, data.email, data.phone || null, data.telegram_chat_id || null)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error adding nurse:", error);
    return c.json({ error: "Erro ao adicionar enfermeiro" }, 500);
  }
});

app.put("/api/nurses/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `UPDATE nurses 
         SET name = ?, coren = ?, email = ?, phone = ?, telegram_chat_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        data.name,
        data.coren,
        data.email,
        data.phone || null,
        data.telegram_chat_id || null,
        new Date().toISOString(),
        id
      )
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating nurse:", error);
    return c.json({ error: "Failed to update nurse" }, 500);
  }
});

app.patch("/api/nurses/:id/toggle", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    await db
      .prepare("UPDATE nurses SET is_active = NOT is_active, updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling nurse:", error);
    return c.json({ error: "Erro ao atualizar enfermeiro" }, 500);
  }
});

app.patch("/api/nurses/:id/notification/:channel", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const channel = c.req.param("channel");
    const db = c.env.DB;
    
    const fieldMap: Record<string, string> = {
      email: "notification_email",
      whatsapp: "notification_whatsapp",
      telegram: "notification_telegram",
    };
    
    const field = fieldMap[channel];
    if (!field) {
      return c.json({ error: "Canal inválido" }, 400);
    }
    
    await db
      .prepare(`UPDATE nurses SET ${field} = NOT ${field}, updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling notification:", error);
    return c.json({ error: "Erro ao atualizar notificação" }, 500);
  }
});

app.delete("/api/nurses/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    await db
      .prepare("DELETE FROM nurses WHERE id = ?")
      .bind(id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting nurse:", error);
    return c.json({ error: "Erro ao excluir enfermeiro" }, 500);
  }
});

// Requesters management endpoints
app.get("/api/requesters", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    const requesters = await db
      .prepare("SELECT * FROM requesters ORDER BY name ASC")
      .all();
    
    return c.json(requesters.results || []);
  } catch (error) {
    console.error("Error fetching requesters:", error);
    return c.json({ error: "Erro ao buscar solicitantes" }, 500);
  }
});

app.post("/api/requesters", authMiddleware, async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `INSERT INTO requesters (name, crm, email, phone, specialty, telegram_chat_id, is_active, notification_email, notification_whatsapp, notification_telegram)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 0)`
      )
      .bind(data.name, data.crm, data.email, data.phone || null, data.specialty || null, data.telegram_chat_id || null)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error adding requester:", error);
    return c.json({ error: "Erro ao adicionar solicitante" }, 500);
  }
});

app.put("/api/requesters/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const data = await c.req.json();
    const db = c.env.DB;
    
    await db
      .prepare(
        `UPDATE requesters 
         SET name = ?, crm = ?, email = ?, phone = ?, specialty = ?, telegram_chat_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        data.name,
        data.crm,
        data.email,
        data.phone || null,
        data.specialty || null,
        data.telegram_chat_id || null,
        new Date().toISOString(),
        id
      )
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating requester:", error);
    return c.json({ error: "Failed to update requester" }, 500);
  }
});

app.patch("/api/requesters/:id/toggle", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    await db
      .prepare("UPDATE requesters SET is_active = NOT is_active, updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling requester:", error);
    return c.json({ error: "Erro ao atualizar solicitante" }, 500);
  }
});

app.delete("/api/requesters/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const db = c.env.DB;
    
    await db
      .prepare("DELETE FROM requesters WHERE id = ?")
      .bind(id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting requester:", error);
    return c.json({ error: "Erro ao excluir solicitante" }, 500);
  }
});

app.patch("/api/requesters/:id/notification/:channel", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const channel = c.req.param("channel");
    const db = c.env.DB;
    
    const fieldMap: Record<string, string> = {
      email: "notification_email",
      whatsapp: "notification_whatsapp",
      telegram: "notification_telegram",
    };
    
    const field = fieldMap[channel];
    if (!field) {
      return c.json({ error: "Canal inválido" }, 400);
    }
    
    await db
      .prepare(`UPDATE requesters SET ${field} = NOT ${field}, updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling notification:", error);
    return c.json({ error: "Erro ao atualizar notificação" }, 500);
  }
});

// Dashboard endpoints
app.get("/api/dashboard/stats", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const today = new Date().toISOString().split('T')[0];

    // Get today's total
    const todayTotal = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE DATE(created_at) = ?")
      .bind(today)
      .first();

    // Get pending - match exact database format "Aguardando validação"
    const pending = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE status LIKE 'Aguardando valida%'")
      .first();

    // Get approved (all time, not just today)
    const approved = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE LOWER(status) = 'aprovada'")
      .first();

    // Get denied (all time, not just today)
    const denied = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE LOWER(status) = 'negada'")
      .first();

    // Get SLA expired
    const slaExpired = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE status LIKE 'Aguardando valida%' AND datetime(sla_deadline) < datetime('now')")
      .first();

    // Get fast-track (immediate priority)
    const fastTrack = await db
      .prepare("SELECT COUNT(*) as count FROM requests WHERE priority_classification = 'imediata' AND DATE(created_at) = ?")
      .bind(today)
      .first();

    // Calculate average response time for today
    const avgTime = await db
      .prepare(`
        SELECT AVG((julianday(decision_at) - julianday(created_at)) * 24 * 60) as avg_minutes
        FROM requests 
        WHERE decision_at IS NOT NULL 
        AND DATE(decision_at) = ?
      `)
      .bind(today)
      .first();

    let avgResponseTime = "-";
    if (avgTime && typeof avgTime.avg_minutes === 'number') {
      const minutes = Math.round(avgTime.avg_minutes);
      avgResponseTime = `${minutes}min`;
    }

    return c.json({
      today_total: todayTotal?.count || 0,
      pending: pending?.count || 0,
      approved: approved?.count || 0,
      denied: denied?.count || 0,
      sla_expired: slaExpired?.count || 0,
      avg_response_time: avgResponseTime,
      fast_track: fastTrack?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return c.json({ error: "Erro ao carregar estatísticas" }, 500);
  }
});

app.get("/api/dashboard/recent", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    const requests = await db
      .prepare(`
        SELECT * FROM requests 
        ORDER BY created_at DESC 
        LIMIT 20
      `)
      .all();
    
    return c.json(requests.results || []);
  } catch (error) {
    console.error("Error fetching recent requests:", error);
    return c.json({ error: "Erro ao carregar solicitações" }, 500);
  }
});

// ===== SETTINGS ROUTES =====

// GET /api/settings - Get all settings
app.get("/api/settings", authMiddleware, async (c) => {
  try {
    const settings = await c.env.DB
      .prepare("SELECT setting_key, setting_value, setting_type, description FROM settings ORDER BY setting_key")
      .all();
    
    return c.json(settings.results);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return c.json({ error: "Erro ao carregar configurações" }, 500);
  }
});

// POST /api/settings - Update settings
app.post("/api/settings", authMiddleware, async (c) => {
  try {
    const updates = await c.req.json<Record<string, string>>();
    
    // Update each setting
    const updatePromises = Object.entries(updates).map(([key, value]) => {
      return c.env.DB
        .prepare("UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?")
        .bind(value, key)
        .run();
    });
    
    await Promise.all(updatePromises);
    
    // If telegram_bot_token was updated, configure webhook automatically
    if (updates.telegram_bot_token) {
      const token = updates.telegram_bot_token;
      // ALWAYS use the .mocha.app domain for webhooks - custom domains don't work with Telegram
      const webhookUrl = `https://nvc.mocha.app/api/telegram/webhook`;
      
      console.log(`[Settings] Configuring Telegram webhook: ${webhookUrl}`);
      
      try {
        const setWebhookResponse = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ["message", "callback_query"],
            }),
          }
        );
        
        const webhookResult = await setWebhookResponse.json() as any;
        console.log(`[Settings] Webhook configuration result:`, webhookResult);
        
        if (!webhookResult.ok) {
          console.error(`[Settings] Failed to set webhook:`, webhookResult.description);
        } else {
          console.log(`[Settings] ✅ Webhook configured successfully for ${webhookUrl}`);
        }
      } catch (webhookError) {
        console.error(`[Settings] Error setting webhook:`, webhookError);
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return c.json({ error: "Erro ao salvar configurações" }, 500);
  }
});

// ===== AUTHENTICATION ROUTES =====

// Authentication endpoints
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// ===== TELEGRAM DIAGNOSTIC ROUTES =====

app.get("/api/telegram/diagnostic", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    // Get Telegram token
    const tokenSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    const token = tokenSetting?.setting_value as string || "";
    const tokenConfigured = !!token;
    const maskedToken = token ? `${token.substring(0, 10)}...${token.substring(token.length - 4)}` : "Não configurado";
    
    // Get webhook info from Telegram API
    let webhookInfo = {
      configured: false,
      url: "",
      pendingUpdates: 0,
    };
    
    if (tokenConfigured) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const data = await response.json() as any;
        
        if (data.ok && data.result) {
          webhookInfo = {
            configured: !!data.result.url,
            url: data.result.url || "Não configurado",
            pendingUpdates: data.result.pending_update_count || 0,
          };
        }
      } catch (error) {
        console.error("Error fetching webhook info:", error);
      }
    }
    
    // Get validators
    const validators = await db
      .prepare("SELECT id, name, telegram_chat_id, notification_telegram FROM validators")
      .all();
    
    // Get recent requests
    const recentRequests = await db
      .prepare("SELECT protocol, patient_name, created_at, assigned_validator_id, status FROM requests ORDER BY created_at DESC LIMIT 5")
      .all();
    
    return c.json({
      telegramToken: {
        configured: tokenConfigured,
        masked: maskedToken,
      },
      webhookInfo,
      validators: validators.results || [],
      recentRequests: recentRequests.results || [],
    });
  } catch (error) {
    console.error("Error in diagnostic:", error);
    return c.json({ error: "Erro ao carregar diagnóstico" }, 500);
  }
});

// Check Telegram webhook info
app.get("/api/telegram/webhook-info", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    // Get bot token from settings
    const tokenSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    const botToken = (tokenSetting as any)?.setting_value;
    
    if (!botToken) {
      return c.json({ error: "Token do bot não configurado" }, 400);
    }
    
    // Get webhook info from Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );
    
    const webhookInfo = await response.json() as any;
    
    return c.json(webhookInfo);
  } catch (error) {
    console.error("Error getting webhook info:", error);
    return c.json({ error: "Erro ao buscar informações do webhook" }, 500);
  }
});

// Reconfigure Telegram webhook
app.post("/api/telegram/reconfigure-webhook", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    
    // Get bot token from settings
    const tokenSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    const botToken = (tokenSetting as any)?.setting_value;
    
    if (!botToken) {
      return c.json({ error: "Token do bot não configurado" }, 400);
    }
    
    // ALWAYS use the .mocha.app domain for webhooks - custom domains don't work with Telegram
    const webhookUrl = `https://nvc.mocha.app/api/telegram/webhook`;
    
    console.log(`[Webhook Reconfig] Setting webhook to: ${webhookUrl}`);
    
    // Set webhook
    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
        }),
      }
    );
    
    const webhookResult = await setWebhookResponse.json() as any;
    console.log(`[Webhook Reconfig] Result:`, webhookResult);
    
    if (!webhookResult.ok) {
      return c.json({ 
        success: false, 
        error: webhookResult.description 
      }, 400);
    }
    
    return c.json({ 
      success: true, 
      webhookUrl,
      result: webhookResult
    });
  } catch (error) {
    console.error("Error reconfiguring webhook:", error);
    return c.json({ error: "Erro ao reconfigurar webhook" }, 500);
  }
});

app.post("/api/telegram/test", authMiddleware, async (c) => {
  const diagnosticLog: any[] = [];
  
  try {
    diagnosticLog.push({ step: "start", message: "Iniciando teste de envio", timestamp: new Date().toISOString() });
    
    const db = c.env.DB;
    
    diagnosticLog.push({ step: "token_fetch", message: "Buscando token do bot no banco de dados..." });
    
    // Get bot token
    const tokenSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    diagnosticLog.push({ 
      step: "token_result", 
      message: tokenSetting?.setting_value ? "Token encontrado" : "Token não encontrado",
      tokenLength: tokenSetting?.setting_value ? (tokenSetting.setting_value as string).length : 0
    });
    
    if (!tokenSetting?.setting_value) {
      diagnosticLog.push({ step: "error", message: "Token do Telegram não configurado" });
      return c.json({ error: "Token do Telegram não configurado", diagnostic: diagnosticLog }, 400);
    }
    
    const botToken = tokenSetting.setting_value as string;
    
    diagnosticLog.push({ step: "validators_fetch", message: "Buscando validadores com Telegram habilitado..." });
    
    // Get validators with Telegram enabled
    const validators = await db
      .prepare(
        `SELECT id, name, telegram_chat_id 
         FROM validators 
         WHERE notification_telegram = 1 
         AND telegram_chat_id IS NOT NULL 
         AND telegram_chat_id != ''`
      )
      .all();
    
    const validatorsList = validators.results as any[] || [];
    
    diagnosticLog.push({ 
      step: "validators_result", 
      message: `Encontrados ${validatorsList.length} validadores`,
      validators: validatorsList.map(v => ({ id: v.id, name: v.name, chatId: v.telegram_chat_id }))
    });
    
    if (validatorsList.length === 0) {
      diagnosticLog.push({ step: "error", message: "Nenhum validador com Telegram configurado" });
      return c.json({ error: "Nenhum validador com Telegram configurado", diagnostic: diagnosticLog }, 400);
    }
    
    // Send test message to each validator
    const testMessage = 
      `🧪 <b>MENSAGEM DE TESTE - NDIR</b>\n\n` +
      `Este é um teste do sistema de notificações do Telegram.\n\n` +
      `Se você recebeu esta mensagem, o sistema está funcionando corretamente! ✅\n\n` +
      `Você receberá notificações reais de solicitações de internação neste chat.`;
    
    diagnosticLog.push({ step: "sending", message: "Iniciando envio de mensagens..." });
    
    let sentCount = 0;
    const sendResults: any[] = [];
    
    for (const validator of validatorsList) {
      const sendLog: any = {
        validatorId: validator.id,
        validatorName: validator.name,
        chatId: validator.telegram_chat_id,
      };
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: validator.telegram_chat_id,
            text: testMessage,
            parse_mode: "HTML",
          }),
        });
        
        const result = await response.json() as any;
        
        sendLog.status = response.status;
        sendLog.success = result.ok;
        sendLog.response = result;
        
        if (result.ok) {
          sentCount++;
          sendLog.message = "Enviado com sucesso";
        } else {
          sendLog.message = `Falhou: ${result.description || "Erro desconhecido"}`;
        }
      } catch (error) {
        sendLog.success = false;
        sendLog.message = `Erro: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      sendResults.push(sendLog);
    }
    
    diagnosticLog.push({ 
      step: "send_results", 
      message: `Enviado para ${sentCount} de ${validatorsList.length} validadores`,
      sendResults 
    });
    
    diagnosticLog.push({ step: "complete", message: "Teste concluído", timestamp: new Date().toISOString() });
    
    return c.json({ 
      success: true, 
      sentTo: sentCount,
      total: validatorsList.length,
      diagnostic: diagnosticLog
    });
  } catch (error) {
    diagnosticLog.push({ 
      step: "fatal_error", 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return c.json({ 
      error: "Erro ao enviar mensagem de teste", 
      diagnostic: diagnosticLog 
    }, 500);
  }
});

// ===== TELEGRAM APPROVAL NOTIFICATION TEST =====
app.post("/api/telegram/test-approval", authMiddleware, async (c) => {
  const diagnosticLog: any[] = [];
  
  try {
    diagnosticLog.push({ step: "start", message: "Iniciando teste de notificação de aprovação", timestamp: new Date().toISOString() });
    
    const db = c.env.DB;
    
    diagnosticLog.push({ step: "token_fetch", message: "Buscando token do bot no banco de dados..." });
    
    // Get bot token
    const tokenSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    diagnosticLog.push({ 
      step: "token_result", 
      message: tokenSetting?.setting_value ? "Token encontrado" : "Token não encontrado",
      tokenLength: tokenSetting?.setting_value ? (tokenSetting.setting_value as string).length : 0
    });
    
    if (!tokenSetting?.setting_value) {
      diagnosticLog.push({ step: "error", message: "Token do Telegram não configurado" });
      return c.json({ error: "Token do Telegram não configurado", diagnostic: diagnosticLog }, 400);
    }
    
    const botToken = tokenSetting.setting_value as string;
    
    // Get nurses with Telegram enabled
    diagnosticLog.push({ step: "nurses_fetch", message: "Buscando enfermeiros com Telegram habilitado..." });
    
    const nurses = await db
      .prepare("SELECT * FROM nurses WHERE is_active = 1 AND notification_telegram = 1 AND telegram_chat_id IS NOT NULL")
      .all();
    
    const nursesList = nurses.results as any[] || [];
    
    diagnosticLog.push({ 
      step: "nurses_result", 
      message: `Encontrados ${nursesList.length} enfermeiros`,
      nurses: nursesList.map(n => ({ id: n.id, name: n.name, chatId: n.telegram_chat_id }))
    });
    
    // Get requesters with Telegram enabled
    diagnosticLog.push({ step: "requesters_fetch", message: "Buscando solicitantes com Telegram habilitado..." });
    
    const requesters = await db
      .prepare("SELECT * FROM requesters WHERE is_active = 1 AND notification_telegram = 1 AND telegram_chat_id IS NOT NULL")
      .all();
    
    const requestersList = requesters.results as any[] || [];
    
    diagnosticLog.push({ 
      step: "requesters_result", 
      message: `Encontrados ${requestersList.length} solicitantes`,
      requesters: requestersList.map(r => ({ id: r.id, name: r.name, chatId: r.telegram_chat_id }))
    });
    
    const totalRecipients = nursesList.length + requestersList.length;
    
    if (totalRecipients === 0) {
      diagnosticLog.push({ step: "error", message: "Nenhum enfermeiro ou solicitante com Telegram configurado" });
      return c.json({ 
        error: "Nenhum enfermeiro ou solicitante com Telegram configurado",
        diagnostic: diagnosticLog 
      }, 400);
    }
    
    // Create test approval message
    const approvalMessage = 
      `✅ <b>TESTE - Solicitação Aprovada</b>\n\n` +
      `Esta é uma mensagem de teste de aprovação.\n\n` +
      `<b>Protocolo:</b> NDIR-TESTE-123456\n` +
      `<b>Paciente:</b> Paciente Teste\n` +
      `<b>Prontuário:</b> 123456\n` +
      `<b>Atendimento MVSOUL:</b> 987654\n` +
      `<b>Convênio:</b> TESTE\n` +
      `<b>Prioridade:</b> URGENTE\n\n` +
      `<b>Decisão:</b> APROVADA ✅\n` +
      `<b>Validador:</b> Sistema de Testes\n\n` +
      `Se você recebeu esta mensagem, você receberá notificações quando solicitações forem aprovadas! 🎉`;
    
    diagnosticLog.push({ step: "sending", message: "Iniciando envio de mensagens..." });
    
    let sentCount = 0;
    const sendResults: any[] = [];
    
    // Send to nurses
    for (const nurse of nursesList) {
      const sendLog: any = {
        type: "nurse",
        id: nurse.id,
        name: nurse.name,
        chatId: nurse.telegram_chat_id,
      };
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: nurse.telegram_chat_id,
            text: approvalMessage,
            parse_mode: "HTML",
          }),
        });
        
        const result = await response.json() as any;
        
        sendLog.status = response.status;
        sendLog.success = result.ok;
        sendLog.response = result;
        
        if (result.ok) {
          sentCount++;
          sendLog.message = "Enviado com sucesso";
        } else {
          sendLog.message = `Falhou: ${result.description || "Erro desconhecido"}`;
        }
      } catch (error) {
        sendLog.success = false;
        sendLog.message = `Erro: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      sendResults.push(sendLog);
    }
    
    // Send to requesters
    for (const requester of requestersList) {
      const sendLog: any = {
        type: "requester",
        id: requester.id,
        name: requester.name,
        chatId: requester.telegram_chat_id,
      };
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: requester.telegram_chat_id,
            text: approvalMessage,
            parse_mode: "HTML",
          }),
        });
        
        const result = await response.json() as any;
        
        sendLog.status = response.status;
        sendLog.success = result.ok;
        sendLog.response = result;
        
        if (result.ok) {
          sentCount++;
          sendLog.message = "Enviado com sucesso";
        } else {
          sendLog.message = `Falhou: ${result.description || "Erro desconhecido"}`;
        }
      } catch (error) {
        sendLog.success = false;
        sendLog.message = `Erro: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      sendResults.push(sendLog);
    }
    
    diagnosticLog.push({ 
      step: "send_results", 
      message: `Enviado para ${sentCount} de ${totalRecipients} destinatários`,
      nurses: nursesList.length,
      requesters: requestersList.length,
      sendResults 
    });
    
    diagnosticLog.push({ step: "complete", message: "Teste concluído", timestamp: new Date().toISOString() });
    
    return c.json({ 
      success: true, 
      sentTo: sentCount,
      totalNurses: nursesList.length,
      totalRequesters: requestersList.length,
      total: totalRecipients,
      diagnostic: diagnosticLog
    });
  } catch (error) {
    diagnosticLog.push({ 
      step: "fatal_error", 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return c.json({ 
      error: "Erro ao enviar mensagem de teste", 
      diagnostic: diagnosticLog 
    }, 500);
  }
});

// ===== CLEANUP TEST DATA =====
app.post("/api/cleanup-test-data", authMiddleware, async (c) => {
  const db = c.env.DB;
  
  try {
    // Count records before deletion
    const requestsCount = await db.prepare("SELECT COUNT(*) as count FROM requests").first() as { count: number };
    const notificationsCount = await db.prepare("SELECT COUNT(*) as count FROM notification_log").first() as { count: number };
    const attachmentsCount = await db.prepare("SELECT COUNT(*) as count FROM request_attachments").first() as { count: number };
    
    // Delete from request_attachments first (foreign key dependency)
    await db.prepare("DELETE FROM request_attachments").run();
    
    // Delete from notification_log
    await db.prepare("DELETE FROM notification_log").run();
    
    // Delete from requests
    await db.prepare("DELETE FROM requests").run();
    
    console.log(`[CLEANUP] Deleted ${requestsCount.count} requests, ${notificationsCount.count} notifications, ${attachmentsCount.count} attachments`);
    
    return c.json({
      success: true,
      requestsDeleted: requestsCount.count,
      notificationsDeleted: notificationsCount.count,
      attachmentsDeleted: attachmentsCount.count
    });
  } catch (error) {
    console.error("[CLEANUP] Error deleting test data:", error);
    return c.json({ 
      error: "Erro ao limpar dados de teste",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ===== SHARED APPROVAL NOTIFICATION FUNCTION =====

// Shared function to send approval notifications to nurses and requesters
// ===== TELEGRAM WEBHOOK ROUTE =====

// Telegram webhook endpoint - receives messages from bot
app.post("/api/telegram/webhook", async (c) => {
  try {
    const update = await c.req.json();
    const db = c.env.DB;
    
    // Log EVERY webhook call - THIS MUST APPEAR IN LOGS
    console.log(`[WEBHOOK] ============ WEBHOOK RECEIVED ============`);
    console.log(`[WEBHOOK] Timestamp: ${new Date().toISOString()}`);
    console.log(`[WEBHOOK] Update type: ${update.callback_query ? 'CALLBACK_QUERY' : update.message ? 'MESSAGE' : 'UNKNOWN'}`);
    console.log(`[WEBHOOK] Full update:`, JSON.stringify(update, null, 2));
    
    // Log to database IMMEDIATELY so it appears in Diagnostico
    try {
      await db
        .prepare(
          "INSERT INTO notification_log (protocol, status, channel, recipient, validator_name, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          "WEBHOOK_HIT",
          "sent",
          "sistema",
          update.callback_query ? `CALLBACK: ${update.callback_query.data}` : update.message ? 'MESSAGE' : 'UNKNOWN',
          JSON.stringify(update).substring(0, 200),
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();
      console.log(`[WEBHOOK] Logged to database successfully`);
    } catch (logError) {
      console.error(`[WEBHOOK] Failed to log to database:`, logError);
    }
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      
      // Get bot token
      const telegramSetting = await db
        .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
        .first();
      
      if (!telegramSetting?.setting_value) {
        console.error("Telegram bot token not configured");
        return c.json({ ok: true });
      }
      
      const botToken = telegramSetting.setting_value as string;
      
      // Parse callback data: "approve:PROTOCOL" or "deny:PROTOCOL"
      const [action, protocol] = callbackData.split(":");
      
      // Log webhook callback received
      try {
        await db
          .prepare(
            "INSERT INTO notification_log (protocol, status, channel, recipient, validator_name, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            protocol || "UNKNOWN",
            "sent",
            "sistema",
            `WEBHOOK_CALLBACK_${action}`,
            String(chatId),
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
      } catch (e) {
        console.error("Error logging webhook callback:", e);
      }
      
      console.log(`[Telegram Callback] Action: ${action}, Protocol: ${protocol}`);
      
      if (!protocol) {
        // Invalid callback data
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "❌ Dados inválidos",
            show_alert: true,
          }),
        });
        return c.json({ ok: true });
      }
      
      // Get validator info by chat_id
      const validator = await db
        .prepare("SELECT * FROM validators WHERE telegram_chat_id = ?")
        .bind(String(chatId))
        .first();
      
      console.log(`[Telegram Callback] Validator found: ${validator ? (validator as any).name : 'NO'}`);
      
      if (!validator) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "❌ Validador não encontrado",
            show_alert: true,
          }),
        });
        return c.json({ ok: true });
      }
      
      // Get request
      const request = await db
        .prepare("SELECT * FROM requests WHERE protocol = ?")
        .bind(protocol)
        .first();
      
      console.log(`[Telegram Callback] Request found: ${request ? 'YES' : 'NO'}, Protocol searched: ${protocol}`);
      
      // Log request lookup
      try {
        await db
          .prepare(
            "INSERT INTO notification_log (protocol, status, channel, recipient, validator_name, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            protocol,
            "sent",
            "sistema",
            request ? "REQUEST_FOUND" : "REQUEST_NOT_FOUND",
            String(chatId),
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
      } catch (e) {
        console.error("Error logging request lookup:", e);
      }
      
      if (!request) {
        // Check if this is a dev vs prod environment issue
        const requestCount = await db
          .prepare("SELECT COUNT(*) as count FROM requests")
          .first();
        
        console.log(`[Telegram Callback] Total requests in database: ${(requestCount as any)?.count || 0}`);
        
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "❌ Solicitação não encontrada. Certifique-se de que a solicitação foi criada no ambiente de produção.",
            show_alert: true,
          }),
        });
        return c.json({ ok: true });
      }
      
      // Check if already processed
      if (request.status !== "aguardando_validacao" && request.status !== "Aguardando validação") {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: `⚠️ Solicitação já ${request.status}`,
            show_alert: true,
          }),
        });
        return c.json({ ok: true });
      }
      
      let decision = "";
      let statusText = "";
      let emoji = "";
      
      console.log(`[TELEGRAM] Determining action type: ${action}`);
      if (action === "approve") {
        decision = "aprovada";
        statusText = "Aprovada";
        emoji = "✅";
        console.log(`[TELEGRAM] Action is APPROVE - will send notifications to nurses/requesters`);
      } else if (action === "deny") {
        decision = "negada";
        statusText = "Negada";
        emoji = "❌";
        console.log(`[TELEGRAM] Action is DENY - no notifications to nurses/requesters`);
      } else {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "❌ Ação inválida",
            show_alert: true,
          }),
        });
        return c.json({ ok: true });
      }
      
      // Update request
      console.log(`[TELEGRAM] Updating request ${protocol} with decision: ${decision}`);
      await db
        .prepare(
          `UPDATE requests 
           SET status = ?, 
               validator_physician = ?, 
               validator_crm = ?,
               decision = ?,
               decision_justification = ?,
               decision_at = ?,
               updated_at = ?
           WHERE protocol = ?`
        )
        .bind(
          decision,
          validator.name,
          validator.crm,
          decision,
          `Decisão via Telegram por ${validator.name}`,
          new Date().toISOString(),
          new Date().toISOString(),
          protocol
        )
        .run();
      
      console.log(`[TELEGRAM] Request updated successfully`);
      
      // Answer callback query
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: `${emoji} Solicitação ${statusText.toLowerCase()}`,
          show_alert: false,
        }),
      });
      
      // Update message for the validator who clicked
      const updatedText = callbackQuery.message.text + `\n\n${emoji} <b>${statusText}</b> por ${validator.name}`;
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] }, // Remove buttons
        }),
      });
      
      // Update ALL other Telegram messages for this protocol (other validators)
      console.log(`[TELEGRAM] Updating all other validator messages for protocol ${protocol}`);
      const allNotifications = await db
        .prepare(
          `SELECT * FROM notification_log 
           WHERE request_protocol = ? 
           AND channel = 'telegram' 
           AND status = 'sent'
           AND telegram_message_id IS NOT NULL`
        )
        .bind(protocol)
        .all();
      
      console.log(`[TELEGRAM] Found ${allNotifications.results?.length || 0} total Telegram notifications`);
      
      for (const notification of allNotifications.results as any[]) {
        // Skip the message we just updated (same chat and message)
        if (notification.recipient === String(chatId) && notification.telegram_message_id === String(messageId)) {
          console.log(`[TELEGRAM] Skipping current message (already updated)`);
          continue;
        }
        
        try {
          console.log(`[TELEGRAM] Updating other validator message: chat_id=${notification.recipient}, message_id=${notification.telegram_message_id}`);
          
          const otherUpdateResponse = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: notification.recipient,
              message_id: parseInt(notification.telegram_message_id),
              text: `${emoji} <b>Solicitação ${statusText}</b>\n\n<b>Validada por:</b> ${validator.name} (via Telegram)\n<b>Protocolo:</b> ${protocol}`,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [] }, // Remove buttons
            }),
          });
          
          const otherResult = await otherUpdateResponse.json() as any;
          if (otherResult.ok) {
            console.log(`[TELEGRAM] ✅ Updated other validator message successfully`);
          } else {
            console.error(`[TELEGRAM] ❌ Failed to update other validator message: ${otherResult.description}`);
          }
        } catch (error) {
          console.error(`[TELEGRAM] Error updating other validator message:`, error);
        }
      }
      
      // Send notifications to nurses and requesters if approved
      console.log(`[TELEGRAM APPROVAL] Decision: "${decision}"`);
      
      if (decision === "aprovada") {
        console.log(`[TELEGRAM APPROVAL] ✅ Calling shared notification function`);
        await sendApprovalNotifications(db, botToken, protocol, request, (validator as any).name);
      }
      
      return c.json({ ok: true });
    }
    
    // Extract message data
    const message = update.message;
    if (!message) {
      return c.json({ ok: true }); // Ignore non-message updates
    }
    
    const chatId = message.chat.id;
    const text = message.text || "";
    const firstName = message.from.first_name || "";
    
    // Get bot token from settings
    const telegramSetting = await db
      .prepare("SELECT setting_value FROM settings WHERE setting_key = 'telegram_bot_token'")
      .first();
    
    if (!telegramSetting?.setting_value) {
      console.error("Telegram bot token not configured");
      return c.json({ ok: true });
    }
    
    const botToken = telegramSetting.setting_value as string;
    
    // Handle /cadastrar command for self-registration
    if (text === "/cadastrar") {
      // Check if already registered
      const existingValidator = await db
        .prepare("SELECT * FROM validators WHERE telegram_chat_id = ?")
        .bind(String(chatId))
        .first();
      
      if (existingValidator) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ Você já está cadastrado como validador!\n\n` +
                  `<b>Nome:</b> ${existingValidator.name}\n` +
                  `<b>CRM:</b> ${existingValidator.crm}\n\n` +
                  `Você receberá notificações de novas solicitações neste chat.`,
            parse_mode: "HTML",
          }),
        });
        return c.json({ ok: true });
      }
      
      // Check for existing incomplete registration
      const existingReg = await db
        .prepare("SELECT * FROM telegram_registrations WHERE telegram_chat_id = ? AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1")
        .bind(String(chatId))
        .first();
      
      if (existingReg) {
        // Delete old incomplete registration
        await db
          .prepare("DELETE FROM telegram_registrations WHERE id = ?")
          .bind(existingReg.id)
          .run();
      }
      
      // Create new registration
      await db
        .prepare(
          `INSERT INTO telegram_registrations (telegram_chat_id, telegram_username, telegram_first_name, registration_step)
           VALUES (?, ?, ?, ?)`
        )
        .bind(
          String(chatId),
          message.from.username || "",
          firstName,
          "awaiting_name"
        )
        .run();
      
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🏥 <b>Cadastro de Validador - NDIR</b>\n\n` +
                `Vamos iniciar seu cadastro!\n\n` +
                `Por favor, envie seu <b>nome completo</b>:`,
          parse_mode: "HTML",
        }),
      });
      
      return c.json({ ok: true });
    }
    
    // Handle registration steps
    const pendingReg = await db
      .prepare("SELECT * FROM telegram_registrations WHERE telegram_chat_id = ? AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1")
      .bind(String(chatId))
      .first() as any;
    
    if (pendingReg) {
      const step = pendingReg.registration_step;
      
      if (step === "awaiting_name") {
        // Save name and ask for CRM
        await db
          .prepare("UPDATE telegram_registrations SET name = ?, registration_step = ?, updated_at = ? WHERE id = ?")
          .bind(text.trim(), "awaiting_crm", new Date().toISOString(), pendingReg.id)
          .run();
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ Nome registrado: <b>${text.trim()}</b>\n\n` +
                  `Agora envie seu <b>número do CRM</b>:`,
            parse_mode: "HTML",
          }),
        });
        
        return c.json({ ok: true });
      }
      
      if (step === "awaiting_crm") {
        // Save CRM and ask for email
        await db
          .prepare("UPDATE telegram_registrations SET crm = ?, registration_step = ?, updated_at = ? WHERE id = ?")
          .bind(text.trim(), "awaiting_email", new Date().toISOString(), pendingReg.id)
          .run();
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ CRM registrado: <b>${text.trim()}</b>\n\n` +
                  `Agora envie seu <b>e-mail</b>:`,
            parse_mode: "HTML",
          }),
        });
        
        return c.json({ ok: true });
      }
      
      if (step === "awaiting_email") {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text.trim())) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ E-mail inválido. Por favor, envie um e-mail válido:`,
              parse_mode: "HTML",
            }),
          });
          return c.json({ ok: true });
        }
        
        // Save email and ask for phone
        await db
          .prepare("UPDATE telegram_registrations SET email = ?, registration_step = ?, updated_at = ? WHERE id = ?")
          .bind(text.trim(), "awaiting_phone", new Date().toISOString(), pendingReg.id)
          .run();
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ E-mail registrado: <b>${text.trim()}</b>\n\n` +
                  `Por último, envie seu <b>telefone</b> (com DDD):\n\n` +
                  `Exemplo: (11) 98765-4321`,
            parse_mode: "HTML",
          }),
        });
        
        return c.json({ ok: true });
      }
      
      if (step === "awaiting_phone") {
        // Save phone and complete registration
        await db
          .prepare("UPDATE telegram_registrations SET phone = ?, registration_step = ?, completed_at = ?, updated_at = ? WHERE id = ?")
          .bind(text.trim(), "completed", new Date().toISOString(), new Date().toISOString(), pendingReg.id)
          .run();
        
        // Get updated registration data
        const completedReg = await db
          .prepare("SELECT * FROM telegram_registrations WHERE id = ?")
          .bind(pendingReg.id)
          .first() as any;
        
        // Create validator record
        await db
          .prepare(
            `INSERT INTO validators (name, crm, email, phone, telegram_chat_id, notification_telegram, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`
          )
          .bind(
            completedReg.name,
            completedReg.crm,
            completedReg.email,
            completedReg.phone,
            String(chatId),
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🎉 <b>Cadastro concluído com sucesso!</b>\n\n` +
                  `<b>Seus dados:</b>\n` +
                  `👤 Nome: ${completedReg.name}\n` +
                  `🏥 CRM: ${completedReg.crm}\n` +
                  `📧 E-mail: ${completedReg.email}\n` +
                  `📱 Telefone: ${completedReg.phone}\n\n` +
                  `✅ Você agora está cadastrado como validador do NDIR!\n\n` +
                  `Você receberá notificações de novas solicitações de internação neste chat. 🏥`,
            parse_mode: "HTML",
          }),
        });
        
        return c.json({ ok: true });
      }
    }
    
    // Default responses for non-registration messages
    let responseMessage = "";
    
    if (text === "/start") {
      responseMessage = `👋 Olá ${firstName}!\n\n` +
        `<b>Bot NDIR - Núcleo Digital de Internação e Regulação</b>\n\n` +
        `📋 <b>Comandos disponíveis:</b>\n\n` +
        `/cadastrar - Cadastrar-se como validador\n` +
        `/meuid - Ver seu Chat ID\n\n` +
        `💡 Se você já é validador, receberá notificações de solicitações neste chat!`;
    } else if (text === "/meuid" || text.toLowerCase().includes("chat") || text.toLowerCase().includes("id")) {
      responseMessage = `✅ Seu <b>Chat ID</b> é:\n\n` +
        `<code>${chatId}</code>\n\n` +
        `📋 Este número pode ser usado para cadastro manual no painel administrativo do NDIR.`;
    } else {
      // Any other message
      responseMessage = `❓ Comando não reconhecido.\n\n` +
        `Use /cadastrar para se registrar como validador ou /meuid para ver seu Chat ID.`;
    }
    
    // Send response via Telegram API
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseMessage,
          parse_mode: "HTML",
        }),
      }
    );
    
    return c.json({ ok: true });
  } catch (error) {
    console.error("Error in Telegram webhook:", error);
    return c.json({ ok: true }); // Always return ok to Telegram
  }
});

// Get user profile by email
app.get("/api/user-profile", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // First, check if profile exists (active or inactive)
    let profile = await db
      .prepare("SELECT * FROM user_profiles WHERE email = ?")
      .bind(user.email)
      .first<{
        id: number;
        email: string;
        role: string;
        name: string | null;
        is_active: number;
      }>();

    // If no profile exists, auto-create a pending one
    if (!profile) {
      console.log(`[USER_PROFILE] Auto-creating pending profile for new user: ${user.email}`);
      const now = new Date().toISOString();
      await db
        .prepare("INSERT INTO user_profiles (email, role, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)")
        .bind(user.email, "nurse", null, now, now)
        .run();
      
      // Fetch the newly created profile
      profile = await db
        .prepare("SELECT * FROM user_profiles WHERE email = ?")
        .bind(user.email)
        .first<{
          id: number;
          email: string;
          role: string;
          name: string | null;
          is_active: number;
        }>();
    }

    // If profile is inactive, return 403 with specific message
    if (profile && profile.is_active === 0) {
      return c.json({ error: "Usuário aguardando aprovação do administrador" }, 403);
    }

    // If still no profile (shouldn't happen), return 404
    if (!profile) {
      return c.json({ error: "User profile not found" }, 404);
    }

    return c.json({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      name: profile.name,
      isActive: profile.is_active === 1,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// Get all user profiles (admin only)
app.get("/api/user-profiles", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const profiles = await db
      .prepare("SELECT * FROM user_profiles ORDER BY created_at DESC")
      .all();

    return c.json((profiles.results || []).map((p: any) => ({
      id: p.id,
      email: p.email,
      role: p.role,
      name: p.name,
      isActive: p.is_active === 1,
      createdAt: p.created_at,
    })));
  } catch (error) {
    console.error("Error fetching user profiles:", error);
    return c.json({ error: "Failed to fetch user profiles" }, 500);
  }
});

// Create user profile (admin only)
app.post("/api/user-profiles", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const { email, role, name } = await c.req.json();

    // Validate role
    if (!["admin", "validator", "nurse"].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    // Check if email already exists
    const existing = await db
      .prepare("SELECT id FROM user_profiles WHERE email = ?")
      .bind(email)
      .first();

    if (existing) {
      return c.json({ error: "User with this email already exists" }, 400);
    }

    await db
      .prepare(
        "INSERT INTO user_profiles (email, role, name, is_active) VALUES (?, ?, ?, 1)"
      )
      .bind(email, role, name || null)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error creating user profile:", error);
    return c.json({ error: "Failed to create user profile" }, 500);
  }
});

// Update user profile (admin only)
app.put("/api/user-profiles/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = c.req.param("id");
    const { email, role, name } = await c.req.json();

    // Validate role
    if (!["admin", "validator", "nurse"].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    // Check if email is being changed and if new email already exists
    const existing = await db
      .prepare("SELECT id FROM user_profiles WHERE email = ? AND id != ?")
      .bind(email, id)
      .first();

    if (existing) {
      return c.json({ error: "User with this email already exists" }, 400);
    }

    await db
      .prepare(
        "UPDATE user_profiles SET email = ?, role = ?, name = ?, updated_at = ? WHERE id = ?"
      )
      .bind(email, role, name || null, new Date().toISOString(), id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return c.json({ error: "Failed to update user profile" }, 500);
  }
});

// Toggle user active status (admin only)
app.patch("/api/user-profiles/:id/toggle", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = c.req.param("id");

    // Get current status
    const profile = await db
      .prepare("SELECT is_active FROM user_profiles WHERE id = ?")
      .bind(id)
      .first<{ is_active: number }>();

    if (!profile) {
      return c.json({ error: "User not found" }, 404);
    }

    const newStatus = profile.is_active === 1 ? 0 : 1;

    await db
      .prepare("UPDATE user_profiles SET is_active = ?, updated_at = ? WHERE id = ?")
      .bind(newStatus, new Date().toISOString(), id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling user status:", error);
    return c.json({ error: "Failed to toggle user status" }, 500);
  }
});

// Delete user profile (admin only)
app.delete("/api/user-profiles/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = c.req.param("id");

    await db
      .prepare("DELETE FROM user_profiles WHERE id = ?")
      .bind(id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return c.json({ error: "Failed to delete user profile" }, 500);
  }
});

// Get notification logs (admin only)
app.get("/api/notification-logs", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user?.email) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const db = c.env.DB;
    
    // Check if user is admin
    const userProfile = await db
      .prepare("SELECT role FROM user_profiles WHERE email = ? AND is_active = 1")
      .bind(user.email)
      .first<{ role: string }>();

    if (!userProfile || userProfile.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Get all notification logs ordered by most recent first
    const logs = await db
      .prepare(`
        SELECT 
          nl.*,
          v.name as validator_name
        FROM notification_log nl
        LEFT JOIN validators v ON nl.validator_id = v.id
        ORDER BY nl.created_at DESC
        LIMIT 500
      `)
      .all();

    return c.json({ results: logs.results || [] });
  } catch (error) {
    console.error("Error fetching notification logs:", error);
    return c.json({ error: "Failed to fetch notification logs" }, 500);
  }
});

export default app;
