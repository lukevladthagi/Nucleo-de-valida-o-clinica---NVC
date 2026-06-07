import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM nurses ORDER BY name ASC`;
    return NextResponse.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (error) {
    console.error("Error listing nurses:", error);
    return NextResponse.json({ error: "Erro ao listar enfermeiros" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO nurses (
        id, name, coren, email, phone, telegram_chat_id, is_active,
        notification_email, notification_whatsapp, notification_telegram, created_at, updated_at
      )
      VALUES (
        (SELECT COALESCE(MAX(id), 0) + 1 FROM nurses),
        ${body.name}, ${body.coren}, ${body.email}, ${body.phone || null}, ${body.telegram_chat_id || null},
        1, 1, 0, ${body.telegram_chat_id ? 1 : 0}, ${now}, ${now}
      )
      RETURNING *
    `;
    return NextResponse.json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) {
    console.error("Error creating nurse:", error);
    return NextResponse.json({ error: "Erro ao criar enfermeiro" }, { status: 500 });
  }
}
