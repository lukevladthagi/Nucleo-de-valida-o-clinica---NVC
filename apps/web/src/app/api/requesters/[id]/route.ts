import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await sql`
      UPDATE requesters
      SET name = ${body.name}, crm = ${body.crm}, email = ${body.email},
          phone = ${body.phone || null}, specialty = ${body.specialty || null},
          telegram_chat_id = ${body.telegram_chat_id || null}, updated_at = ${new Date().toISOString()}
      WHERE id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating requester:", error);
    return NextResponse.json({ error: "Erro ao atualizar solicitante" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await sql`DELETE FROM requesters WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting requester:", error);
    return NextResponse.json({ error: "Erro ao excluir solicitante" }, { status: 500 });
  }
}
