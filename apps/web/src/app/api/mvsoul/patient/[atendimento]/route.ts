import { getMvsoulCredentials, getMvsoulToken } from '@/app/api/utils/mvsoul';

const DATE_KEYS = [
  'dt_resultado',
  'DT_RESULTADO',
  'dt_coleta',
  'DT_COLETA',
  'dt_laudo',
  'DT_LAUDO',
  'dt_sinal_vital',
  'DT_SINAL_VITAL',
  'dt_afericao',
  'DT_AFERICAO',
  'data',
  'DATA',
  'created_at',
  'CREATED_AT',
];

function firstValue(record: any, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function normalizeRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [
    payload.results,
    payload.resultados,
    payload.data,
    payload.items,
    payload.registros,
    payload.sinais_vitais,
    payload.exames,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [payload];
}

function parseDate(value: any) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brDate) {
    return new Date(`${brDate[3]}-${brDate[2]}-${brDate[1]}T00:00:00`);
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRecordDate(record: any) {
  return parseDate(firstValue(record, DATE_KEYS));
}

function formatDateBR(value: any) {
  const date = parseDate(value);
  if (!date) return null;
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function latestRowsByDate(rows: any[]) {
  const datedRows = rows
    .map((row) => ({ row, date: getRecordDate(row) }))
    .filter((item): item is { row: any; date: Date } => Boolean(item.date));

  if (datedRows.length === 0) return rows;

  const latestTime = Math.max(...datedRows.map((item) => item.date.getTime()));
  const latest = datedRows
    .filter((item) => {
      const latestDay = new Date(latestTime);
      return (
        item.date.getFullYear() === latestDay.getFullYear() &&
        item.date.getMonth() === latestDay.getMonth() &&
        item.date.getDate() === latestDay.getDate()
      );
    })
    .map((item) => item.row);

  return latest.length > 0 ? latest : [datedRows.find((item) => item.date.getTime() === latestTime)!.row];
}

function compact(value: any) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function filterRowsForPatient(rows: any[], atendimento: string, cdPaciente: any) {
  const atendimentoText = String(atendimento);
  const cdPacienteText = cdPaciente ? String(cdPaciente) : '';

  const filtered = rows.filter((row) => {
    const rowAtendimento = firstValue(row, [
      'cd_atendimento',
      'CD_ATENDIMENTO',
      'atendimento',
      'ATENDIMENTO',
      'nr_atendimento',
      'NR_ATENDIMENTO',
    ]);
    const rowPaciente = firstValue(row, [
      'cd_paciente',
      'CD_PACIENTE',
      'paciente_id',
      'PACIENTE_ID',
      'id_paciente',
      'ID_PACIENTE',
    ]);

    const matchesAtendimento = rowAtendimento && String(rowAtendimento) === atendimentoText;
    const matchesPaciente = cdPacienteText && rowPaciente && String(rowPaciente) === cdPacienteText;

    return matchesAtendimento || matchesPaciente;
  });

  return filtered;
}

function formatLabResults(rows: any[]) {
  if (rows.length === 0) return null;
  const latestRows = latestRowsByDate(rows).slice(0, 30);
  const dateLabel =
    formatDateBR(firstValue(latestRows[0], DATE_KEYS)) ||
    new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const lines = latestRows
    .map((row) => {
      const exam = compact(
        firstValue(row, ['nm_exame', 'NM_EXAME', 'ds_exame', 'DS_EXAME', 'exame', 'EXAME', 'nome'])
      );
      const result = compact(
        firstValue(row, [
          'resultado',
          'RESULTADO',
          'ds_resultado',
          'DS_RESULTADO',
          'vl_resultado',
          'VL_RESULTADO',
          'valor',
          'VALOR',
        ])
      );
      const unit = compact(firstValue(row, ['unidade', 'UNIDADE', 'ds_unidade', 'DS_UNIDADE']));

      if (!exam && !result) return '';
      return `${exam || 'Resultado'}: ${[result, unit].filter(Boolean).join(' ')}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return null;
  return `${dateLabel}\n${lines.join('\n')}`;
}

function formatVitalSigns(rows: any[]) {
  if (rows.length === 0) return null;
  const latestRows = latestRowsByDate(rows);
  const latest = latestRows[latestRows.length - 1];
  const dateLabel =
    formatDateBR(firstValue(latest, DATE_KEYS)) ||
    new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const signs = [
    ['Pressão arterial', ['pressao_arterial', 'PRESSAO_ARTERIAL', 'pa', 'PA', 'ds_pressao', 'DS_PRESSAO']],
    ['Temperatura', ['temperatura', 'TEMPERATURA', 'temp', 'TEMP', 'vl_temperatura', 'VL_TEMPERATURA']],
    ['Frequência cardíaca', ['frequencia_cardiaca', 'FREQUENCIA_CARDIACA', 'fc', 'FC']],
    ['Frequência respiratória', ['frequencia_respiratoria', 'FREQUENCIA_RESPIRATORIA', 'fr', 'FR']],
    ['Saturação O2', ['saturacao', 'SATURACAO', 'sato2', 'SATO2', 'spo2', 'SPO2']],
    ['Glicemia', ['glicemia', 'GLICEMIA', 'hgt', 'HGT']],
    ['Dor', ['dor', 'DOR', 'escala_dor', 'ESCALA_DOR']],
  ];

  const lines = signs
    .map(([label, keys]) => {
      const value = compact(firstValue(latest, keys as string[]));
      return value ? `${label}: ${value}` : '';
    })
    .filter(Boolean);

  if (lines.length === 0) {
    const ignored = new Set(DATE_KEYS);
    for (const [key, value] of Object.entries(latest)) {
      if (ignored.has(key)) continue;
      const text = compact(value);
      if (text && lines.length < 8) lines.push(`${key}: ${text}`);
    }
  }

  if (lines.length === 0) return null;
  return `${dateLabel}\n${lines.join('\n')}`;
}

async function fetchMvEndpoint(
  apiUrl: string,
  accessToken: string,
  endpoint: string,
  atendimento: string,
  cdPaciente: any,
  diagnosticLog: string[]
) {
  const queries = [
    `atendimento=${encodeURIComponent(atendimento)}`,
    `cd_atendimento=${encodeURIComponent(atendimento)}`,
  ];

  if (cdPaciente) {
    queries.push(`paciente_id=${encodeURIComponent(String(cdPaciente))}`);
    queries.push(`cd_paciente=${encodeURIComponent(String(cdPaciente))}`);
  }

  for (const query of queries) {
    const url = `${apiUrl}api/${endpoint}/?${query}`;
    try {
      diagnosticLog.push(`[MV] Buscando ${endpoint}: ${url}`);
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      diagnosticLog.push(`[MV] ${endpoint} respondeu: ${response.status}`);
      if (!response.ok) continue;

      const payload = await response.json();
      const rows = filterRowsForPatient(normalizeRows(payload), atendimento, cdPaciente);
      diagnosticLog.push(`[MV] ${endpoint}: ${rows.length} registro(s) normalizado(s)/filtrado(s)`);
      if (rows.length > 0) return rows;
    } catch (error: any) {
      diagnosticLog.push(`[MV] Erro em ${endpoint}: ${error?.message || 'erro desconhecido'}`);
    }
  }

  return [];
}

async function timedStep<T>(label: string, diagnosticLog: string[], fn: () => Promise<T>) {
  const start = Date.now();
  try {
    const result = await fn();
    diagnosticLog.push(`[tempo] ${label}: ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    diagnosticLog.push(`[tempo] ${label}: erro em ${Date.now() - start}ms`);
    throw error;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ atendimento: string }> }
) {
  const diagnosticLog: string[] = [];

  try {
    const url = new URL(request.url);
    const quickMode = url.searchParams.get('quick') === '1';
    const supplementalMode = url.searchParams.get('scope') === 'supplemental';
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
      accessToken = await timedStep('autenticacao MVSOUL', diagnosticLog, () =>
        getMvsoulToken(apiUrl, apiUser, apiPassword)
      );
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
      const response = await timedStep('dados do paciente', diagnosticLog, () =>
        fetch(patientUrl, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );
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

    if (supplementalMode) {
      const cd_paciente = data.cd_paciente;
      diagnosticLog.push(`[12] Modo complementar. cd_paciente: ${cd_paciente}`);

      const [labRows, vitalRows] = await timedStep('laboratorio e sinais vitais', diagnosticLog, () =>
        Promise.all([
          fetchMvEndpoint(apiUrl, accessToken, 'resultados-lab', atendimento, cd_paciente, diagnosticLog),
          fetchMvEndpoint(apiUrl, accessToken, 'sinais-vitais', atendimento, cd_paciente, diagnosticLog),
        ])
      );

      const labResultsText = formatLabResults(labRows);
      const vitalSignsText = formatVitalSigns(vitalRows);

      return Response.json({
        lab_results: labResultsText,
        labResults: labResultsText,
        vital_signs: vitalSignsText,
        vitalSigns: vitalSignsText,
        _diagnostic: diagnosticLog,
      });
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

    let labRows: any[] = [];
    let vitalRows: any[] = [];

    if (!quickMode) {
      [labRows, vitalRows] = await timedStep('laboratorio e sinais vitais', diagnosticLog, () =>
        Promise.all([
          fetchMvEndpoint(apiUrl, accessToken, 'resultados-lab', atendimento, cd_paciente, diagnosticLog),
          fetchMvEndpoint(apiUrl, accessToken, 'sinais-vitais', atendimento, cd_paciente, diagnosticLog),
        ])
      );
    } else {
      diagnosticLog.push('[MV] Modo rapido: laboratorio e sinais vitais serao carregados em segundo plano.');
    }

    const labResultsText = formatLabResults(labRows);
    const vitalSignsText = formatVitalSigns(vitalRows);

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
      lab_results: labResultsText,
      labResults: labResultsText,
      vital_signs: vitalSignsText,
      vitalSigns: vitalSignsText,
      supplementalPending: quickMode,
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
