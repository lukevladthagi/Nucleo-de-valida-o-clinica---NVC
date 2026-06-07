// Email template components
export const emailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    ${content}
  </div>
</body>
</html>
`;

export const emailHeader = (title: string, priority: string) => {
  const priorityColors: Record<string, { bg: string; text: string }> = {
    'Imediata': { bg: '#dc2626', text: '#ffffff' },
    'Urgente': { bg: '#f59e0b', text: '#ffffff' },
    'Eletiva': { bg: '#3b82f6', text: '#ffffff' },
  };
  
  const colors = priorityColors[priority] || priorityColors['Eletiva'];
  
  return `
<div style="padding: 32px 40px 24px 40px; background-color: ${colors.bg};">
  <div style="display: flex; align-items: center; margin-bottom: 8px;">
    <div style="background-color: rgba(255, 255, 255, 0.2); padding: 8px 12px; border-radius: 6px; display: inline-block;">
      <span style="color: ${colors.text}; font-size: 12px; font-weight: 600; text-transform: uppercase;">PRIORIDADE ${priority.toUpperCase()}</span>
    </div>
  </div>
  <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${colors.text};">${title}</h1>
</div>
`;
};

export const emailBody = (content: string) => `
<div style="padding: 32px 40px;">
  ${content}
</div>
`;

export const emailButton = (text: string, url: string, color: string = "#3b82f6") => `
<a href="${url}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: ${color}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">${text}</a>
`;

export const emailFooter = (text: string) => `
<div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
  <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">${text}</p>
</div>
`;

interface NotificationData {
  protocol: string;
  patientName: string;
  mvSoulNumber: string;
  insurance: string;
  priority: string;
  risk: string;
  slaMinutes: number;
  clinicalPresentation: string;
  validationUrl: string;
}

export function buildNotificationEmail(data: NotificationData): { subject: string; html: string; text: string } {
  const priorityColors: Record<string, string> = {
    imediata: "#dc2626",
    urgente: "#f59e0b",
    eletiva: "#3b82f6",
  };
  
  const priorityLabels: Record<string, string> = {
    imediata: "IMEDIATA",
    urgente: "URGENTE",
    eletiva: "ELETIVA",
  };
  
  const priority = data.priority.toLowerCase();
  const priorityColor = priorityColors[priority] || priorityColors.eletiva;
  const priorityLabel = priorityLabels[priority] || "ELETIVA";
  
  const isFastTrack = priority === "imediata";
  
  const subject = isFastTrack 
    ? `🚨 FAST-TRACK: Nova Solicitação de Pré-Internação — ${data.protocol}`
    : `Nova Solicitação de Pré-Internação — ${data.protocol}`;
  
  const html = emailTemplate(`
    ${emailHeader("Nova Solicitação de Pré-Internação — NDIR", data.priority)}
    ${emailBody(`
      ${isFastTrack ? `
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">⚠️ CASO ELEGÍVEL PARA FAST-TRACK</p>
        </div>
      ` : ''}
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Protocolo:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #18181b;">${data.protocol}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Paciente:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #18181b;">${data.patientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Atendimento:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #18181b;">${data.mvSoulNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Convênio:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #18181b;">${data.insurance}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Prioridade:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; background-color: ${priorityColor}; color: #ffffff; font-size: 12px; font-weight: 600; border-radius: 4px;">${priorityLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Risco:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #18181b;">${data.risk}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #71717a;">SLA:</td>
          <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #dc2626;">${data.slaMinutes} minutos</td>
        </tr>
      </table>
      
      <div style="background-color: #f4f4f5; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Resumo Clínico</p>
        <p style="margin: 0; font-size: 14px; line-height: 21px; color: #3f3f46;">${data.clinicalPresentation}</p>
      </div>
      
      ${emailButton("Avaliar Solicitação", data.validationUrl, priorityColor)}
      
      <p style="margin: 0; font-size: 12px; color: #71717a;">
        Esta solicitação requer validação médica dentro do prazo de SLA estabelecido.
      </p>
    `)}
    ${emailFooter("NDIR — Núcleo Digital de Internação e Regulação | Prontocardio")}
  `);
  
  const text = `
Nova Solicitação de Pré-Internação — NDIR

${isFastTrack ? '⚠️ CASO ELEGÍVEL PARA FAST-TRACK\n' : ''}
Paciente: ${data.patientName}
Atendimento: ${data.mvSoulNumber}
Convênio: ${data.insurance}
Prioridade: ${priorityLabel}
Risco: ${data.risk}
SLA: ${data.slaMinutes} minutos

Resumo clínico:
${data.clinicalPresentation}

Acesse para validar:
${data.validationUrl}
  `.trim();
  
  return { subject, html, text };
}
