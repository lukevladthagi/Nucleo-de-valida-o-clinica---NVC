import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { ValidatorDecisionSchema } from '@/shared/types';

function normalizeStatus(decision: string) {
  if (decision === 'aprovada_com_observacao') return 'aprovada';
  return decision;
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
      RETURNING id, protocol, decision, status
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      request: updated[0],
      diagnostic: {
        protocol,
        decision: data.decision,
        decisionAt,
      },
    });
  } catch (error) {
    console.error('Error registering decision:', error);
    return NextResponse.json({ error: 'Erro ao registrar decisão' }, { status: 500 });
  }
}
