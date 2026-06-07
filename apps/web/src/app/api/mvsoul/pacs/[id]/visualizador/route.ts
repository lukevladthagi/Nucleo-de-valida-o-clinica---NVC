import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idExamePedido } = await params;

    const { apiUser, apiPassword, apiUrl } = await getMvsoulCredentials();

    if (!apiUser || !apiPassword) {
      return Response.json(
        { error: 'Credenciais da API do MVSOUL não configuradas' },
        { status: 400 }
      );
    }

    const accessToken = await getMvsoulToken(apiUrl, apiUser, apiPassword);

    const visualizadorResponse = await fetch(`${apiUrl}api/pacs/${idExamePedido}/visualizador/`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!visualizadorResponse.ok) {
      return Response.json({ error: 'Erro ao buscar visualizador' }, { status: 500 });
    }

    const visualizadorData = await visualizadorResponse.json();
    return Response.json(visualizadorData);
  } catch (error) {
    console.error('Error fetching visualizador:', error);
    return Response.json({ error: 'Erro ao buscar visualizador' }, { status: 500 });
  }
}
