import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const email = session.user.email;

    // Look up user profile by email
    const rows = await sql`
      SELECT id, email, role, name, is_active
      FROM user_profiles
      WHERE email = ${email}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não possui perfil cadastrado no sistema' },
        { status: 404 }
      );
    }

    const profile = rows[0];

    // Check if user is active
    if (profile.is_active !== 1 && profile.is_active !== '1') {
      return NextResponse.json(
        { error: 'Usuário aguardando aprovação do administrador' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: Number(profile.id),
      email: profile.email,
      role: profile.role,
      name: profile.name,
      isActive: profile.is_active === 1 || profile.is_active === '1',
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar perfil do usuário' },
      { status: 500 }
    );
  }
}
