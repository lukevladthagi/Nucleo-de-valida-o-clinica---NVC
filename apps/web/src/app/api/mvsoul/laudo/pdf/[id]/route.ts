import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idExamePedido } = await params;

    console.log(`[PDF] Attempting to fetch laudo PDF for exam ID: ${idExamePedido}`);

    const { apiUser, apiPassword, apiUrl } = await getMvsoulCredentials();

    if (!apiUser || !apiPassword) {
      console.log(`[PDF] MVSOUL credentials not configured`);
      return Response.json(
        { error: 'Credenciais da API do MVSOUL não configuradas' },
        { status: 400 }
      );
    }

    const accessToken = await getMvsoulToken(apiUrl, apiUser, apiPassword);

    // Fetch PDF from MVSOUL
    console.log(`[PDF] Fetching from MVSOUL: ${apiUrl}api/pacs/${idExamePedido}/pdf/`);

    const pdfResponse = await fetch(`${apiUrl}api/pacs/${idExamePedido}/pdf/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!pdfResponse.ok) {
      console.log(`[PDF] MVSOUL API returned error: ${pdfResponse.status}`);
      return Response.json({ error: 'Erro ao buscar PDF do laudo' }, { status: 500 });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log(`[PDF] Downloaded from MVSOUL: ${Math.round(pdfBuffer.byteLength / 1024)} KB`);

    if (pdfBuffer.byteLength === 0) {
      console.log(`[PDF] PDF is empty (0 bytes)`);
      return Response.json({ error: 'PDF vazio recebido' }, { status: 500 });
    }

    const pdfBytes = new Uint8Array(pdfBuffer);

    // Check if content is text-based (RTF or plain text) instead of PDF
    const textPreview = new TextDecoder('utf-8').decode(pdfBytes.slice(0, 500));

    const isRtf = textPreview.includes('{\\rtf') || textPreview.includes('\\rtf1');
    const isPlainText =
      /^[\x20-\x7E\s]+/.test(textPreview.substring(0, 100)) && !textPreview.startsWith('%PDF');

    if (isRtf || isPlainText) {
      console.log(`[PDF] Content is text-based (RTF or plain text), not PDF binary`);
      return Response.json(
        {
          error: 'not_pdf',
          format: isRtf ? 'rtf' : 'text',
          message: 'Este laudo está em formato de texto, não PDF',
        },
        { status: 400 }
      );
    }

    // Validate PDF header
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    if (!header.startsWith('%PDF')) {
      console.log(`[PDF] Invalid PDF header: "${header}"`);
      return Response.json(
        {
          error: 'invalid_pdf',
          details: `Cabeçalho recebido: ${header}`,
          preview: textPreview.substring(0, 100),
        },
        { status: 500 }
      );
    }

    console.log(`[PDF] Valid PDF header detected ✓`);

    // Return PDF binary
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[PDF] Error fetching laudo PDF:', error);
    return Response.json({ error: 'Erro ao buscar PDF do laudo' }, { status: 500 });
  }
}
