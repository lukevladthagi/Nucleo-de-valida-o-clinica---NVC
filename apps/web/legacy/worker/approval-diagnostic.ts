// Helper to track approval notification diagnostics
export interface ApprovalDiagnostic {
  timestamp: string;
  protocol: string;
  decision: string;
  botTokenConfigured: boolean;
  nursesFound: number;
  nursesWithTelegram: number;
  nursesSent: Array<{ name: string; chat_id: string; success: boolean; error?: string }>;
  requestersFound: number;
  requestersWithTelegram: number;
  requestersSent: Array<{ name: string; chat_id: string; success: boolean; error?: string }>;
  errors: string[];
}

const diagnostics = new Map<string, ApprovalDiagnostic>();

export function createDiagnostic(protocol: string, decision: string): ApprovalDiagnostic {
  const diagnostic: ApprovalDiagnostic = {
    timestamp: new Date().toISOString(),
    protocol,
    decision,
    botTokenConfigured: false,
    nursesFound: 0,
    nursesWithTelegram: 0,
    nursesSent: [],
    requestersFound: 0,
    requestersWithTelegram: 0,
    requestersSent: [],
    errors: [],
  };
  
  diagnostics.set(protocol, diagnostic);
  return diagnostic;
}

export function getDiagnostic(protocol: string): ApprovalDiagnostic | undefined {
  return diagnostics.get(protocol);
}

export function clearDiagnostic(protocol: string): void {
  diagnostics.delete(protocol);
}
