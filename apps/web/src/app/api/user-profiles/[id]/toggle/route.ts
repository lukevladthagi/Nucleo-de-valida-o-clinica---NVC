import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const now = new Date().toISOString();
    await sql`
      UPDATE user_profiles
      SET is_active = CASE WHEN COALESCE(is_active, 0) = 1 THEN 0 ELSE 1 END,
          updated_at = ${now}
      WHERE id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error toggling user profile:", error);
    return NextResponse.json({ error: "Erro ao alterar status do usuário" }, { status: 500 });
  }
}
