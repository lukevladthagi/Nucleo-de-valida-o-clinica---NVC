import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

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
