import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pacienteId = url.searchParams.get('paciente_id');

    if (!pacienteId) {
      return Response.json({ error: 'paciente_id é obrigatório' }, { status: 400 });
    }

    const { apiUser, apiPassword, apiUrl } = await getMvsoulCredentials();

    if (!apiUser || !apiPassword) {
      return Response.json(
        { error: 'Credenciais da API do MVSOUL não configuradas' },
        { status: 400 }
      );
    }

    const accessToken = await getMvsoulToken(apiUrl, apiUser, apiPassword);

    const laudoResponse = await fetch(`${apiUrl}api/laudo/?paciente_id=${pacienteId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!laudoResponse.ok) {
      return Response.json({ error: 'Erro ao buscar laudos' }, { status: 500 });
    }

    const laudoData = await laudoResponse.json();

    return Response.json(laudoData);
  } catch (error) {
    console.error('Error fetching laudos:', error);
    return Response.json({ error: 'Erro ao buscar laudos' }, { status: 500 });
  }
}
