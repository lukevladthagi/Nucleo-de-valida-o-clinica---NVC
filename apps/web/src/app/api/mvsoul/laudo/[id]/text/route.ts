import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idExamePedido } = await params;

    console.log(`[LAUDO TEXT] Fetching text content for exam ID: ${idExamePedido}`);

    const { apiUser, apiPassword, apiUrl } = await getMvsoulCredentials();

    if (!apiUser || !apiPassword) {
      return Response.json(
        { error: 'Credenciais da API do MVSOUL não configuradas' },
        { status: 400 }
      );
    }

    const accessToken = await getMvsoulToken(apiUrl, apiUser, apiPassword);

    const laudoResponse = await fetch(`${apiUrl}api/laudo/${idExamePedido}/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!laudoResponse.ok) {
      console.log(`[LAUDO TEXT] API returned error: ${laudoResponse.status}`);
      return Response.json({ error: 'Erro ao buscar laudo' }, { status: 500 });
    }

    const laudoData = (await laudoResponse.json()) as any;

    const rtfContent = laudoData.ds_laudo_rtf;
    const txtContent = laudoData.ds_laudo_txt;

    if (!rtfContent && !txtContent) {
      console.log(`[LAUDO TEXT] No RTF or TXT content available`);
      return Response.json(
        {
          error: 'no_text_content',
          message: 'Este laudo não possui conteúdo em formato texto',
          id_exame_pedido: idExamePedido,
          has_rtf: false,
          has_txt: false,
        },
        { status: 404 }
      );
    }

    return Response.json({
      id_exame_pedido: idExamePedido,
      nome_exa_rx: laudoData.nome_exa_rx,
      dt_laudo: laudoData.dt_laudo,
      ds_laudo_rtf: rtfContent || null,
      ds_laudo_txt: txtContent || null,
      has_rtf: !!rtfContent,
      has_txt: !!txtContent,
      has_pdf: false,
      format: rtfContent ? 'rtf' : 'txt',
    });
  } catch (error) {
    console.error('[LAUDO TEXT] Error:', error);
    return Response.json({ error: 'Erro ao buscar texto do laudo' }, { status: 500 });
  }
}
