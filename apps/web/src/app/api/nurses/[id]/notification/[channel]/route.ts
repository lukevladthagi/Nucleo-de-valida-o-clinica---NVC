import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string; channel: string }> }) {
  try {
    const { id, channel } = await params;
    if (channel === "email") {
      await sql`UPDATE nurses SET notification_email = CASE WHEN COALESCE(notification_email, 0) = 1 THEN 0 ELSE 1 END WHERE id = ${Number(id)}`;
    } else if (channel === "whatsapp") {
      await sql`UPDATE nurses SET notification_whatsapp = CASE WHEN COALESCE(notification_whatsapp, 0) = 1 THEN 0 ELSE 1 END WHERE id = ${Number(id)}`;
    } else if (channel === "telegram") {
      await sql`UPDATE nurses SET notification_telegram = CASE WHEN COALESCE(notification_telegram, 0) = 1 THEN 0 ELSE 1 END WHERE id = ${Number(id)}`;
    } else {
      return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error toggling nurse notification:", error);
    return NextResponse.json({ error: "Erro ao alterar notificação" }, { status: 500 });
  }
}
