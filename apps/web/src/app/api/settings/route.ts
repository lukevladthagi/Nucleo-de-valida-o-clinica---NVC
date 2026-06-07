import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const rows = await sql`
      SELECT setting_key, setting_value, setting_type, description
      FROM settings
      ORDER BY setting_key
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Erro ao carregar configurações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // body is a Record<string, string> of setting_key -> setting_value
    const entries = Object.entries(body) as [string, string][];

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Nenhuma configuração fornecida' }, { status: 400 });
    }

    // Upsert each setting
    for (const [key, value] of entries) {
      // Skip transient UI state keys
      if (key === 'show_access_code') continue;

      const existing = await sql`
        SELECT id FROM settings WHERE setting_key = ${key} LIMIT 1
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE settings
          SET setting_value = ${String(value)},
              updated_at = ${new Date().toISOString()}
          WHERE setting_key = ${key}
        `;
      } else {
        await sql`
          INSERT INTO settings (setting_key, setting_value, setting_type, description)
          VALUES (${key}, ${String(value)}, 'string', '')
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
  }
}
