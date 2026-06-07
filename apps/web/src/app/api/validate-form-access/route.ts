import sql from '@/app/api/utils/sql';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    const secureRows = await sql`
      SELECT setting_value FROM settings WHERE setting_key = 'form_access_secure'
    `;

    const codeRows = await sql`
      SELECT setting_value FROM settings WHERE setting_key = 'form_access_code'
    `;

    const secureEnabled = secureRows[0];
    const storedCode = codeRows[0];

    // If secure mode is not enabled, allow access
    if (!secureEnabled || secureEnabled.setting_value !== '1') {
      return Response.json({ valid: true });
    }

    // Check if provided code matches stored code
    const valid = storedCode && storedCode.setting_value === code;

    return Response.json({ valid: !!valid });
  } catch (error) {
    console.error('Error validating form access:', error);
    return Response.json({ valid: false }, { status: 500 });
  }
}
