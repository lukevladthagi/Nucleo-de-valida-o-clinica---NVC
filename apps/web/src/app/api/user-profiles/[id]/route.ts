import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "nurse").trim();
    const name = String(body.name || "").trim() || null;
    const now = new Date().toISOString();

    await sql`
      UPDATE user_profiles
      SET email = ${email}, role = ${role}, name = ${name}, updated_at = ${now}
      WHERE id = ${Number(id)}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await sql`DELETE FROM user_profiles WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return NextResponse.json({ error: "Erro ao excluir usuário" }, { status: 500 });
  }
}
