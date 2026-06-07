import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const rows = await sql`
      SELECT 
        id, protocol, patient_name, mvsoul_number, insurance,
        priority_classification, clinical_risk, status,
        requesting_physician, validator_physician, decision,
        created_at, medical_record_number
      FROM requests
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching recent requests:', error);
    return NextResponse.json({ error: 'Erro ao buscar solicitações recentes' }, { status: 500 });
  }
}
