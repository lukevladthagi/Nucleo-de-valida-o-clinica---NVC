import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await sql`
      UPDATE nurses
      SET name = ${body.name}, coren = ${body.coren}, email = ${body.email},
          phone = ${body.phone || null}, telegram_chat_id = ${body.telegram_chat_id || null},
          updated_at = ${new Date().toISOString()}
      WHERE id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating nurse:", error);
    return NextResponse.json({ error: "Erro ao atualizar enfermeiro" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await sql`DELETE FROM nurses WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting nurse:", error);
    return NextResponse.json({ error: "Erro ao excluir enfermeiro" }, { status: 500 });
  }
}
