import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ atendimento: string }> }
) {
  const diagnosticLog: string[] = [];

  try {
    const { atendimento } = await params;
    diagnosticLog.push(`[1] Recebido atendimento: ${atendimento}`);

    if (!atendimento) {
      return Response.json(
        { error: 'Número de atendimento é obrigatório', diagnostic: diagnosticLog },
        { status: 400 }
      );
    }

    // Get MVSOUL credentials
    diagnosticLog.push('[2] Buscando credenciais no banco de dados...');
    const { apiUser, apiPassword, apiUrl } = await getMvsoulCredentials();

    diagnosticLog.push(`[3] URL da API: ${apiUrl}`);
    diagnosticLog.push(`[4] Usuário configurado: ${apiUser ? 'SIM' : 'NÃO'}`);
    diagnosticLog.push(`[5] Senha configurada: ${apiPassword ? 'SIM' : 'NÃO'}`);

    if (!apiUser || !apiPassword) {
      return Response.json(
        {
          error:
            'Credenciais da API do MVSOUL não configuradas. Configure nas Configurações do Sistema.',
          diagnostic: diagnosticLog,
        },
        { status: 400 }
      );
    }

    // Authenticate
    diagnosticLog.push(`[6] Tentando autenticação em: ${apiUrl}api/auth/token/`);
    let accessToken: string;
    try {
      accessToken = await getMvsoulToken(apiUrl, apiUser, apiPassword);
      diagnosticLog.push('[8] Token recebido: SIM');
    } catch (err: any) {
      diagnosticLog.push(`[8] Erro de autenticação: ${err.message}`);
      return Response.json(
        {
          error: 'Falha na autenticação com MVSOUL. Verifique usuário e senha nas configurações.',
          diagnostic: diagnosticLog,
        },
        { status: 401 }
      );
    }

    // Fetch patient data
    const patientUrl = `${apiUrl}api/atend-ndir/${atendimento}`;
    diagnosticLog.push(`[9] Buscando dados do paciente em: ${patientUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let data: any;
    try {
      const response = await fetch(patientUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      clearTimeout(timeoutId);

      diagnosticLog.push(`[10] Resposta dos dados: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        diagnosticLog.push(`[11] Erro ao buscar dados: ${errorText.substring(0, 200)}`);

        if (response.status === 404) {
          return Response.json(
            { error: 'Atendimento não encontrado na API do MVSOUL', diagnostic: diagnosticLog },
            { status: 404 }
          );
        }
        return Response.json(
          { error: `Erro na API do MVSOUL: ${response.status}`, diagnostic: diagnosticLog },
          { status: 500 }
        );
      }

      data = await response.json();
      diagnosticLog.push(
        `[11] Dados recebidos com sucesso. Campos: ${Object.keys(data).join(', ')}`
      );
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        diagnosticLog.push('[ERRO] Timeout - API demorou mais de 30 segundos');
        return Response.json(
          {
            error: 'A API do MVSOUL demorou muito para responder. Tente novamente.',
            diagnostic: diagnosticLog,
          },
          { status: 504 }
        );
      }
      throw fetchErr;
    }

    // Fetch evolutions
    const cd_paciente = data.cd_paciente;
    diagnosticLog.push(`[12] cd_paciente: ${cd_paciente}. Buscando evoluções...`);

    let firstEvolution: any = null;
    let lastEvolution: any = null;

    try {
      const evolutionUrl = `${apiUrl}api/evolucao/?paciente_id=${cd_paciente}`;
      diagnosticLog.push(`[13] Buscando evoluções em: ${evolutionUrl}`);

      const evolutionResponse = await fetch(evolutionUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      diagnosticLog.push(`[14] Resposta da evolução: ${evolutionResponse.status}`);

      if (evolutionResponse.ok) {
        const evolutionData = (await evolutionResponse.json()) as any;
        const allResults = evolutionData.results || evolutionData;

        if (Array.isArray(allResults) && allResults.length > 0) {
          diagnosticLog.push(`[15] Evoluções retornadas. Total: ${allResults.length}`);

          const patientId = cd_paciente?.toString();
          const results = allResults.filter((ev: any) => {
            const evPatientId = (ev.CD_PACIENTE || ev.cd_paciente)?.toString();
            return evPatientId === patientId;
          });

          diagnosticLog.push(
            `[15b] Evoluções filtradas para paciente ${patientId}: ${results.length}`
          );

          if (results.length > 0) {
            const sortedResults = [...results].sort((a: any, b: any) => {
              const dateA = `${a.DT_PRE_MED || a.dt_pre_med || ''}T${a.HR_PRE_MED || a.hr_pre_med || '00:00:00'}`;
              const dateB = `${b.DT_PRE_MED || b.dt_pre_med || ''}T${b.HR_PRE_MED || b.hr_pre_med || '00:00:00'}`;
              return new Date(dateA).getTime() - new Date(dateB).getTime();
            });

            firstEvolution = sortedResults[0];
            lastEvolution = sortedResults[sortedResults.length - 1];

            // Get doctor name from first evolution
            const nmPrestador = firstEvolution.NM_PRESTADOR || firstEvolution.nm_prestador;
            const nmUsuario = firstEvolution.NM_USUARIO || firstEvolution.nm_usuario;
            if (nmPrestador) {
              firstEvolution._normalized_doctor = nmPrestador;
            } else if (nmUsuario) {
              firstEvolution._normalized_doctor = nmUsuario;
            }

            // Get text from last evolution
            const lastEvolutionText = lastEvolution.ds_evolucao || lastEvolution.DS_EVOLUCAO;
            const lastEvolutionDateOnly = lastEvolution.DT_PRE_MED || lastEvolution.dt_pre_med;
            const lastEvolutionTime = lastEvolution.HR_PRE_MED || lastEvolution.hr_pre_med;
            const hrAtendimento = lastEvolution.HR_ATENDIMENTO || lastEvolution.hr_atendimento;

            let lastEvolutionDate = hrAtendimento;
            if (!lastEvolutionDate && lastEvolutionDateOnly) {
              if (lastEvolutionTime) {
                const timeClean = lastEvolutionTime.split('.')[0];
                lastEvolutionDate = `${lastEvolutionDateOnly}T${timeClean}`;
              } else {
                lastEvolutionDate = lastEvolutionDateOnly;
              }
            }

            lastEvolution._normalized_text = lastEvolutionText;
            lastEvolution._normalized_date = lastEvolutionDate;

            diagnosticLog.push(`[17] Última evolução - Data combinada: ${lastEvolutionDate}`);
            diagnosticLog.push(`[18] ds_evolucao disponível: ${lastEvolutionText ? 'SIM' : 'NÃO'}`);
          }
        } else {
          diagnosticLog.push('[15] Nenhuma evolução encontrada');
        }
      }
    } catch (evolutionError: any) {
      diagnosticLog.push(`[ERRO] Erro ao buscar evolução: ${evolutionError.message}`);
      console.error('Error fetching evolution:', evolutionError);
    }

    return Response.json({
      ...data,
      nm_prestador_evolucao: firstEvolution?._normalized_doctor || null,
      ds_evolucao:
        lastEvolution?._normalized_text ||
        lastEvolution?.ds_evolucao ||
        lastEvolution?.DS_EVOLUCAO ||
        null,
      dt_pre_med:
        lastEvolution?._normalized_date ||
        lastEvolution?.dt_pre_med ||
        lastEvolution?.DT_PRE_MED ||
        null,
      _diagnostic: diagnosticLog,
    });
  } catch (error: any) {
    diagnosticLog.push(`[ERRO FATAL] ${error?.message || 'Unknown error'}`);
    console.error('Error fetching patient from MVSOUL:', error);
    return Response.json(
      {
        error: 'Erro ao conectar com a API do MVSOUL. Verifique se o serviço está disponível.',
        details: error?.message || 'Unknown error',
        diagnostic: diagnosticLog,
      },
      { status: 500 }
    );
  }
}
