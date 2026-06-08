import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET(
  _request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { protocol } = await params;

    const rows = await sql`
      SELECT *
      FROM requests
      WHERE protocol = ${protocol}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching request:', error);
    return NextResponse.json({ error: 'Erro ao buscar solicitação' }, { status: 500 });
  }
}
