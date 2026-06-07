import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const now = new Date().toISOString();
    await sql`
      UPDATE validators
      SET name = ${body.name}, crm = ${body.crm}, email = ${body.email},
          phone = ${body.phone || null}, telegram_chat_id = ${body.telegram_chat_id || null},
          updated_at = ${now}
      WHERE id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating validator:", error);
    return NextResponse.json({ error: "Erro ao atualizar validador" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await sql`DELETE FROM validators WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting validator:", error);
    return NextResponse.json({ error: "Erro ao excluir validador" }, { status: 500 });
  }
}
