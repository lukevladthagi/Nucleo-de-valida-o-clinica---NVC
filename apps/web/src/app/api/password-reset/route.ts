import { randomUUID, randomBytes, scrypt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";

export const runtime = "nodejs";

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function derivePasswordKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      {
        cost: 16384,
        blockSize: 16,
        parallelization: 1,
        maxmem: 128 * 16384 * 16 * 2,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derivePasswordKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function getRecoveryCode() {
  const rows = await sql`
    SELECT setting_key, setting_value
    FROM settings
    WHERE setting_key IN ('password_reset_code', 'form_access_code')
  `;

  const map = new Map(rows.map((row: any) => [row.setting_key, row.setting_value]));
  return String(process.env.PASSWORD_RESET_CODE || map.get("password_reset_code") || map.get("form_access_code") || "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const recoveryCode = String(body.recoveryCode || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
    }

    const configuredCode = await getRecoveryCode();
    if (!configuredCode) {
      return NextResponse.json(
        { error: "Código de recuperação não configurado. Peça para a TI configurar o código de reset." },
        { status: 400 }
      );
    }

    if (recoveryCode !== configuredCode) {
      return NextResponse.json({ error: "Código de recuperação inválido." }, { status: 403 });
    }

    let userRows = await sql`
      SELECT id, name, email
      FROM "user"
      WHERE lower(email) = ${email}
      LIMIT 1
    `;

    const profileRows = await sql`
      SELECT name, email, is_active
      FROM user_profiles
      WHERE lower(email) = ${email}
      LIMIT 1
    `;

    if (profileRows.length > 0 && Number((profileRows[0] as any).is_active) !== 1) {
      return NextResponse.json({ error: "Usuário inativo. Peça a reativação para a TI." }, { status: 403 });
    }

    if (userRows.length === 0) {
      if (profileRows.length === 0) {
        return NextResponse.json(
          { error: "E-mail não encontrado. Use Criar usuário ou peça o cadastro para a TI." },
          { status: 404 }
        );
      }

      const now = new Date();
      const userId = randomUUID();
      const name = String((profileRows[0] as any).name || email.split("@")[0]);

      await sql`
        INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
        VALUES (${userId}, ${name}, ${email}, ${true}, ${null}, ${now}, ${now})
      `;

      userRows = [{ id: userId, name, email } as any];
    }

    const user = userRows[0] as any;
    const hashedPassword = await hashPassword(password);
    const now = new Date();

    const accountRows = await sql`
      SELECT id
      FROM account
      WHERE "userId" = ${user.id}
        AND "providerId" = 'credential'
      LIMIT 1
    `;

    if (accountRows.length > 0) {
      await sql`
        UPDATE account
        SET password = ${hashedPassword},
            "updatedAt" = ${now}
        WHERE id = ${(accountRows[0] as any).id}
      `;
    } else {
      await sql`
        INSERT INTO account (
          id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
        )
        VALUES (
          ${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${hashedPassword}, ${now}, ${now}
        )
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: "Erro ao redefinir senha." }, { status: 500 });
  }
}
