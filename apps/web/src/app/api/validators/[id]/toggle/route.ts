import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`UPDATE validators SET is_active = CASE WHEN COALESCE(is_active, 0) = 1 THEN 0 ELSE 1 END WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error toggling validator:", error);
    return NextResponse.json({ error: "Erro ao alterar validador" }, { status: 500 });
  }
}
