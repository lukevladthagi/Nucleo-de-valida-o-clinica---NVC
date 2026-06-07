import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, email, role, name, is_active, created_at
      FROM user_profiles
      ORDER BY is_active ASC, name ASC, email ASC
    `;

    return NextResponse.json(rows.map((row) => ({
      id: Number(row.id),
      email: row.email,
      role: row.role,
      name: row.name,
      isActive: row.is_active === 1 || row.is_active === "1",
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error("Error listing user profiles:", error);
    return NextResponse.json({ error: "Erro ao listar usuários" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "nurse").trim();
    const name = String(body.name || "").trim() || null;

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    const exists = await sql`SELECT id FROM user_profiles WHERE lower(email) = ${email} LIMIT 1`;
    if (exists.length > 0) {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO user_profiles (id, email, role, name, is_active, created_at, updated_at)
      VALUES (
        (SELECT COALESCE(MAX(id), 0) + 1 FROM user_profiles),
        ${email}, ${role}, ${name}, 1, ${now}, ${now}
      )
      RETURNING id, email, role, name, is_active, created_at
    `;

    const row = rows[0];
    return NextResponse.json({
      id: Number(row.id),
      email: row.email,
      role: row.role,
      name: row.name,
      isActive: row.is_active === 1 || row.is_active === "1",
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
