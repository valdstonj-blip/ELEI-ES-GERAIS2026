import Papa from 'papaparse';
import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';
import { RAW_PLANILHA_GERAL_DASH_CSV } from '../data/locaisComprehensiveData';
import { INITIAL_OCORRENCIAS, INITIAL_FALTAS } from '../data/mockData';

const CACHE_KEYS = {
  LOCAIS: 'eleicoes2026_locais_cache_v5103_faithful_v4',
  OCORRENCIAS: 'eleicoes2026_ocorrencias_cache_v2',
  FALTAS: 'eleicoes2026_faltas_cache',
  CONFIG: 'eleicoes2026_config_cache',
  LAST_SYNC: 'eleicoes2026_last_sync',
};

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export const isSim = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toUpperCase();
  // Conforme determinação operacional: valores negativos
  if (s === 'N' || s === 'NÃO' || s === 'NAO' || s === 'FALSE' || s === '0' || s === '-' || s === 'X,X,X,X,X') return false;
  const clean = s.replace(/[^A-Z0-9]/g, '');
  return (
    clean === 'SIM' ||
    clean === 'S' ||
    clean === 'TRUE' ||
    clean === '1' ||
    clean === 'OK' ||
    clean === 'X' ||
    clean === 'IMPLANTADA' ||
    clean === 'IMPLANTADO' ||
    clean === 'DESMOBILIZADA' ||
    clean === 'DESMOBILIZADO' ||
    clean === 'CONCLUIDO' ||
    clean === 'CONCLUIDA' ||
    clean === 'REALIZADA' ||
    clean === 'REALIZADO' ||
    s.startsWith('SIM')
  );
};

const parseBool = isSim;

// Function to detect and ignore CPA separator rows, subtotals, or empty lines
function isCpaSeparatorOrEmptyRow(row: any): boolean {
  const numZona = String(row['NUM_ZONA'] || row['ZONA'] || row['Zona'] || '').trim().toUpperCase();
  const nomeLocal = String(row['NOM_LOCAL'] || row['LOCAL_VOTACAO'] || row['NOME'] || '').trim().toUpperCase();
  const endereco = String(row['ENDERECO_LOCAL'] || row['ENDERECO'] || '').trim();

  // If no local name and no address, it's an empty line or spacer
  if (!nomeLocal && !endereco) return true;

  // Header repetitions
  if (numZona === 'NUM_ZONA' || numZona === 'ZONA') return true;

  // CPA section dividers (e.g. "1° CPA - COMANDO...", "TOTAL GERAL", etc.)
  if (numZona.includes('CPA') || numZona.includes('TOTAL') || numZona.includes('SUBTOTAL') || numZona.includes('COMANDO')) {
    return true;
  }

  // If nomeLocal is only a CPA section heading without a real address
  if ((nomeLocal.includes('1° CPA') || nomeLocal.includes('2° CPA') || nomeLocal.includes('3° CPA') || nomeLocal.includes('4° CPA') || nomeLocal.includes('5° CPA') || nomeLocal.includes('6° CPA') || nomeLocal.includes('7° CPA') || nomeLocal.includes('8° CPA') || nomeLocal.includes('COMANDO DE POLICIAMENTO')) && (!endereco || endereco.length < 4)) {
    return true;
  }

  return false;
}

export function parseLocaisCsv(csvText: string): LocalVotacao[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim(),
  });

  if (!result.data || result.data.length === 0) return [];

  const locais: LocalVotacao[] = [];
  const rows = result.data as any[];

  rows.forEach((row, index) => {
    // Linha física exata na planilha do Google Sheets (1-indexed: linha 1 é o cabeçalho, índice 0 é linha 2)
    const physicalLine = index + 2;

    if (isCpaSeparatorOrEmptyRow(row)) return;

    // Detect column variations
    const numZona = String(row['NUM_ZONA'] || row['ZONA'] || row['Zona'] || '').trim();
    const codMunicipio = String(row['COD_MUNICIPIO_TSE'] || row['COD_MUNICIPIO'] || '').trim();
    const cep = String(row['NUM_CEP_LOCAL'] || row['CEP'] || '').trim();
    const numLocal = String(row['NUM_LOCAL'] || row['LOCAL'] || '').trim();
    const qtdSecoes = parseNumber(row['QTD_SECOES'] || row['SECOES']);
    const qtdAptos = parseNumber(row['QTD_APTOS'] || row['APTOS']);
    const municipio = String(row['NOM_MUNICIPIO'] || row['MUNICIPIO'] || 'RIO DE JANEIRO').trim();
    const bairro = String(row['NOM_BAIRRO'] || row['BAIRRO'] || '').trim();
    const endereco = String(row['ENDERECO_LOCAL'] || row['ENDERECO'] || '').trim();
    const nomeLocal = String(row['NOM_LOCAL'] || row['LOCAL_VOTACAO'] || row['NOME'] || '').trim();
    const cpa = String(row['CPA'] || '1° CPA').trim();
    const uop = String(row['UOP'] || row['BATALHAO'] || '').trim();

      // Sensitive area & armored support
      const keySensivel = Object.keys(row).find((k) => k.toUpperCase().includes('SENSIV') || k.toUpperCase().includes('SENSÍV'));
      const areaSensivelRaw = keySensivel ? row[keySensivel] : (row['ÁREA SENSIVEL (SIM/NÃO)'] || row['ÁREA SENSÍVEL (SIM / NÃO)'] || row['AREA SENSIVEL']);

      const keyDomingoImp = Object.keys(row).find((k) => {
        const u = k.toUpperCase();
        return u.includes('DOMINGO') && (u.includes('IMPLANT') || u.includes('NECESSIDADE'));
      });
      const implantacaoRaw = keyDomingoImp ? row[keyDomingoImp] : (row['NECESSIDADE DE IMPLANTAÇÃO DA URNA NO DOMINGO'] || row['NECESSIDADE DE IMPLANTAÇÃO DA URNA NO DOMINGO?'] || row['IMPLANTACAO DOMINGO']);

      const keyBlindado = Object.keys(row).find((k) => k.toUpperCase().includes('BLINDADO'));
      const blindadoRaw = keyBlindado ? row[keyBlindado] : (row['UTILIZAÇÃO DO BLINDADO PARA IMPLANTAÇÃO DA URNA(SIM/NÃO)'] || row['UTILIZAÇÃO DO BLINDADO PARA IMPLANTAÇÃO DA URNA (SIM / NÃO)'] || row['BLINDADO']);

      // Personnel (suporta 2º Turno 24OUT/25OUT e 1º Turno 03OUT/04OUT ou cabeçalhos por extenso de SÁBADO e DOMINGO)
      const keySabado = Object.keys(row).find((k) => {
        const u = k.toUpperCase();
        return u.includes('24OUT') || u.includes('03OUT') || ((u.includes('SÁBADO') || u.includes('SABADO')) && u.includes('EFETIVO'));
      }) || Object.keys(row).find((k) => k.toUpperCase().includes('SÁBADO') || k.toUpperCase().includes('SABADO'));

      const keyDomingo = Object.keys(row).find((k) => {
        const u = k.toUpperCase();
        return u.includes('25OUT') || u.includes('04OUT') || ((u.includes('DOMINGO')) && u.includes('EFETIVO'));
      }) || Object.keys(row).find((k) => k.toUpperCase().includes('DOMINGO'));

      const efetivoSabado = parseNumber(keySabado ? row[keySabado] : (row['EFETIVO DIA 24OUT26'] || row['EFETIVO DIA 03OUT26'] || row['EFETIVO_SABADO']));
      const efetivoDomingo = parseNumber(keyDomingo ? row[keyDomingo] : (row['EFETIVO DIA 25OUT26'] || row['EFETIVO DIA 04OUT26'] || row['EFETIVO_DOMINGO']));

      const keyObs = Object.keys(row).find((k) => k.toUpperCase().includes('OBS'));
      const observacoes = String(keyObs ? row[keyObs] : (row['OBSERVAÇÕS E ALTERAÇÕES'] || row['OBSERVAÇÕES E ALTERAÇÕES'] || '')).trim();

      const allRowKeys = Object.keys(row);

      // Busca flexível pela coluna ALTERAÇÕES NA VOTAÇÃO 2° TURNO (Coluna O / índice 14 na planilha)
      const keyAlt2Turno = allRowKeys.find((k) => {
        const norm = k
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (norm.includes('ENERGIA') || norm.includes('CABO')) return false;

        return (
          (norm.includes('ALTERA') && (norm.includes('2') || norm.includes('TURNO') || norm.includes('SEGUNDO') || norm.includes('VOTACAO'))) ||
          norm.includes('ALTERACOES NA VOTACAO 2 TURNO') ||
          norm.includes('ALTERACOES VOTACAO 2 TURNO') ||
          norm.includes('ALTERACAO VOTACAO 2 TURNO') ||
          norm.includes('ALTERACAO 2 TURNO') ||
          norm.includes('ALTERACOES 2 TURNO')
        );
      });

      let alteracoes2TurnoRaw = keyAlt2Turno ? row[keyAlt2Turno] : (
        row['ALTERAÇÕES NA VOTAÇÃO 2° TURNO'] ||
        row['ALTERACOES NA VOTACAO 2° TURNO'] ||
        row['ALTERAÇÕES NA VOTAÇÃO 2º TURNO'] ||
        row['ALTERACOES NA VOTACAO 2º TURNO'] ||
        row['ALTERAÇÕES NA VOTAÇÃO 2 TURNO'] ||
        row['ALTERAÇÃO 2° TURNO'] ||
        row['ALTERAÇÃO 2º TURNO'] ||
        row['ALTERAÇÕES 2° TURNO'] ||
        row['ALTERAÇÕES 2º TURNO'] ||
        ''
      );

      // Fallback posicional: Coluna O da planilha Google Sheets corresponde ao índice 14 (15ª coluna)
      if ((!alteracoes2TurnoRaw || String(alteracoes2TurnoRaw).trim() === '') && allRowKeys.length >= 15) {
        const candHeader = allRowKeys[14];
        if (candHeader && (candHeader.toUpperCase().includes('ALTERA') || candHeader.toUpperCase().includes('TURNO') || candHeader.toUpperCase().includes('VOTA'))) {
          alteracoes2TurnoRaw = row[candHeader];
        }
      }

      const alteracoes2Turno = String(alteracoes2TurnoRaw || '').trim();
      const lowerAlt2 = alteracoes2Turno.toLowerCase();
      const hasAlteracoes2Turno = (
        alteracoes2Turno.length > 0 &&
        alteracoes2Turno !== '-' &&
        lowerAlt2 !== 'não' &&
        lowerAlt2 !== 'nao' &&
        lowerAlt2 !== 'sem alteração' &&
        lowerAlt2 !== 'sem alteracao' &&
        lowerAlt2 !== 'nada consta' &&
        lowerAlt2 !== 'ok' &&
        lowerAlt2 !== 'normal' &&
        lowerAlt2 !== 'nenhuma' &&
        lowerAlt2 !== 'nenhum'
      );

      // Busca flexível pela coluna de ALTERAÇÃO DE ENERGIA ELÉTRICA / FURTO DE CABOS
      const keyEnergia = allRowKeys.find((k) => {
        const norm = k
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return (
          (norm.includes('ENERGIA') && (norm.includes('ALTERA') || norm.includes('CABO') || norm.includes('FURTO') || norm.includes('ROUBO') || norm.includes('ELETRIC') || norm.includes('RELACION'))) ||
          norm.includes('ROUBO FURTO CABO') ||
          norm.includes('FURTO CABO') ||
          norm.includes('FALTA DE ENERGIA') ||
          norm.includes('ALTERACAO LOCAL MOTIVO ROUBO FURTO CABO ENERGIA')
        );
      });

      let alteracaoEnergiaRaw = keyEnergia ? row[keyEnergia] : (
        row['LOCAL TEVE ALTERAÇÃO COM RELAÇÃO A ENERGIA ELÉTRICA.( INFORME SE HOUVE ALGO RELACIONADO)'] ||
        row['alteração_local_motivo_roubo_furto_cabo_energia'] ||
        row['ALTERACAO_LOCAL_MOTIVO_ROUBO_FURTO_CABO_ENERGIA'] ||
        row['ALTERAÇÃO DE ENERGIA'] ||
        row['ENERGIA ELETRICA'] ||
        ''
      );

      // Fallback posicional se houver 22 ou 21 colunas
      if (!alteracaoEnergiaRaw) {
        if (allRowKeys.length >= 22 && row[allRowKeys[19]] !== undefined) {
          alteracaoEnergiaRaw = row[allRowKeys[19]];
        } else if (allRowKeys.length >= 21 && row[allRowKeys[18]] !== undefined) {
          alteracaoEnergiaRaw = row[allRowKeys[18]];
        }
      }

      const alteracaoEnergia = String(alteracaoEnergiaRaw || '').trim();
      const lowerEnergia = alteracaoEnergia.toLowerCase();
      const hasAlteracaoEnergia = (
        alteracaoEnergia.length > 0 &&
        alteracaoEnergia !== '-' &&
        lowerEnergia !== 'não' &&
        lowerEnergia !== 'nao' &&
        lowerEnergia !== 'sem alteração' &&
        lowerEnergia !== 'sem alteracao' &&
        lowerEnergia !== 'nada consta' &&
        lowerEnergia !== 'ok' &&
        lowerEnergia !== 'normal'
      );

      // Busca flexível e inteligente pela coluna URNA / URNAS IMPLANTADA(S)
      const keyImplantada = allRowKeys.find((k) => {
        const norm = k
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // NUNCA confundir com colunas de blindado, domingo, energia ou necessidade de planejamento
        if (norm.includes('DOMINGO') || norm.includes('NECESSIDADE') || norm.includes('BLINDADO') || norm.includes('ENERGIA') || norm.includes('CABO')) return false;
        if (norm.includes('DESMOBILIZ') || norm.includes('DESMOB') || norm.includes('RECOLHI')) return false;

        return (
          (norm.includes('URNA') && norm.includes('IMPLANT')) ||
          (norm.includes('URNAS') && norm.includes('IMPLANT')) ||
          norm.includes('IMPLANTADA') ||
          norm.includes('IMPLANTADO') ||
          norm.includes('IMPLANTACAO') ||
          norm.includes('LOCAL IMPLANT') ||
          norm.includes('STATUS IMPLANT') ||
          norm.includes('ENTREGA DA URNA') ||
          norm.includes('URNA ENTREGUE') ||
          norm.includes('URNA NO LOCAL')
        );
      });

      // Busca flexível e inteligente pela coluna DESMOBILIZAÇÃO
      const keyDesmobilizada = allRowKeys.find((k) => {
        const norm = k
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return (
          norm.includes('DESMOBILIZ') ||
          norm.includes('DESMOB') ||
          norm.includes('RECOLHIMENTO') ||
          norm.includes('RECOLHIDA') ||
          norm.includes('RETIRADA DA URNA')
        );
      });

      let implantadaRaw = keyImplantada ? row[keyImplantada] : (row['URNA IMPLANTADA'] || row['URNA IMPLANTADA NO LOCAL DE VOTAÇÃO'] || row['IMPLANTAÇÃO REALIZADA (SIM / NÃO)'] || row['IMPLANTADA']);
      let desmobilizadaRaw = keyDesmobilizada ? row[keyDesmobilizada] : (row['DESMOBILIZAÇÃO.'] || row['DESMOBILIZAÇÃO'] || row['DESMOBILIZAÇÃO DO LOCAL DE VOTAÇÃO'] || row['DESMOBILIZADA']);

      // Fallbacks posicionais:
      if (implantadaRaw === undefined || implantadaRaw === null || implantadaRaw === '') {
        if (allRowKeys.length >= 22 && row[allRowKeys[20]] !== undefined) {
          implantadaRaw = row[allRowKeys[20]];
        } else if (allRowKeys.length >= 21 && row[allRowKeys[19]] !== undefined) {
          implantadaRaw = row[allRowKeys[19]];
        } else if (allRowKeys.length >= 19 && row[allRowKeys[18]] !== undefined) {
          implantadaRaw = row[allRowKeys[18]];
        } else if (allRowKeys.length >= 15 && row[allRowKeys[14]] !== undefined) {
          implantadaRaw = row[allRowKeys[14]];
        }
      }
      if (desmobilizadaRaw === undefined || desmobilizadaRaw === null || desmobilizadaRaw === '') {
        if (allRowKeys.length >= 22 && row[allRowKeys[21]] !== undefined) {
          desmobilizadaRaw = row[allRowKeys[21]];
        } else if (allRowKeys.length >= 21 && row[allRowKeys[20]] !== undefined) {
          desmobilizadaRaw = row[allRowKeys[20]];
        } else if (allRowKeys.length >= 20 && row[allRowKeys[19]] !== undefined) {
          desmobilizadaRaw = row[allRowKeys[19]];
        } else if (allRowKeys.length >= 16 && row[allRowKeys[15]] !== undefined) {
          desmobilizadaRaw = row[allRowKeys[15]];
        }
      }

      const isAreaSensivel = parseBool(areaSensivelRaw);
      const isImplantacaoDomingo = parseBool(implantacaoRaw);
      const isBlindado = parseBool(blindadoRaw);
      const isImplantada = parseBool(implantadaRaw);
      const isDesmobilizada = parseBool(desmobilizadaRaw);
      const localResolved = nomeLocal || (endereco ? `Local - ${endereco}` : `Local ${numLocal || index + 1}`);

      locais.push({
        id: `local-${index + 1}-${numLocal || Math.random().toString(36).substr(2, 5)}`,
        numZona: numZona || '0',
        codMunicipio,
        cep,
        numLocal: numLocal || String(index + 1),
        qtdSecoes,
        qtdAptos,
        municipio,
        bairro,
        endereco,
        nomeLocal: localResolved,
        cpa,
        uop,
        areaSensivel: isAreaSensivel,
        implantacaoDomingo: isImplantacaoDomingo,
        blindado: isBlindado,
        efetivoSabado,
        efetivoDomingo,
        observacoes,
        alteracaoEnergia,
        hasAlteracaoEnergia,
        alteracoes2Turno,
        hasAlteracoes2Turno,
        implantada: isImplantada,
        desmobilizada: isDesmobilizada,
        linhaPlanilha: physicalLine,

        // Aliases
        local: localResolved,
        zonaEleitoral: numZona || '0',
        quantidadeSecoes: qtdSecoes,
        totalEleitoresAptos: qtdAptos,
        necessidadeImplantacaoDomingo: isImplantacaoDomingo,
        utilizacaoBlindado: isBlindado,
        observacao: observacoes,
      });
  });

  return locais.filter((item) => item.nomeLocal && item.nomeLocal.length > 0);
}

function classifyOcorrenciaCategoria(row: any): string {
  const rawCat = String(row['Categoria'] || row['CATEGORIA'] || row['Categoria de Ocorrência'] || row['Grupo'] || '').trim();
  const lower = rawCat.toLowerCase();
  if (lower.includes('candidato')) return 'Crimes comuns contra candidatos';
  if (lower.includes('comuns nos locais') || lower.includes('locais de votação')) return 'Crimes comuns nos locais de votação';
  if (lower.includes('eleitora')) return 'Crimes eleitorais';
  if (lower.includes('segurança pública') || lower.includes('incidentes')) return 'Incidentes de segurança pública';
  if (lower.includes('prisõ') || lower.includes('apreensõ') || lower.includes('prisoes')) return 'Prisões e apreensões no entorno';

  const text = `${row['Tipo de Ocorrência'] || row['Natureza'] || row['TIPO'] || ''} ${row['Histórico Sucinto'] || row['HISTORICO'] || ''} ${row['Envolvidos / Detidos'] || ''}`.toLowerCase();

  if (text.includes('candidato') || text.includes('comitê') || (text.includes('partido') && text.includes('ameaça'))) {
    return 'Crimes comuns contra candidatos';
  }
  if (text.includes('preso') || text.includes('prisão') || text.includes('apreensão') || text.includes('mandado') || text.includes('flagrante')) {
    return 'Prisões e apreensões no entorno';
  }
  if (text.includes('boca de urna') || text.includes('santinho') || text.includes('propaganda') || text.includes('transporte') || text.includes('compra de voto') || text.includes('sigilo') || text.includes('eleitoral')) {
    return 'Crimes eleitorais';
  }
  if (text.includes('disparo') || text.includes('tiro') || text.includes('barricada') || text.includes('energia') || text.includes('incêndio') || text.includes('aglomeração') || text.includes('bloqueio')) {
    return 'Incidentes de segurança pública';
  }
  return 'Crimes comuns nos locais de votação';
}

export function parseOcorrenciasCsv(csvText: string): Ocorrencia[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  if (!result.data || result.data.length === 0) return [];

  const rows = result.data as any[];

  return rows.map((row, index) => {
    const keys = Object.keys(row);

    // 1. Carimbo de data/hora
    const carimbo = String(
      row['Carimbo de data/hora'] ||
      row['Carimbo de data e hora'] ||
      row['Data/Hora'] ||
      row['CARIMBO'] ||
      new Date().toLocaleString('pt-BR')
    ).trim();

    // 2. Comando Intermediário (CPA), OPM e Informante
    let comandoIntermediario = '1° CPA';
    let opm = '';
    let posto = '';
    let rg = '';
    let nomeGuerra = '';
    let email = '';

    for (const k of keys) {
      const upper = k.toUpperCase().trim();
      const val = String(row[k] || '').trim();

      if (
        upper.includes('COMANDO INTERMEDIÁRIO') ||
        upper.includes('COMANDO INTERMEDIARIO') ||
        upper === 'CPA'
      ) {
        comandoIntermediario = normalizeCpaName(val);
      }
      if (
        upper === 'OPM' ||
        upper === 'UOP' ||
        upper.includes('BATALHÃO') ||
        upper.includes('BATALHAO')
      ) {
        opm = val;
      }
      if (!posto && (upper === 'POSTO' || upper === 'GRADUAÇÃO' || upper === 'POSTO/GRADUAÇÃO')) {
        posto = val;
      }
      if (!rg && (upper === 'RG' || upper === 'MATRÍCULA' || upper === 'MATRICULA')) {
        rg = val;
      }
      if (!nomeGuerra && (upper === 'NOME DE GUERRA' || upper === 'NOME GUERRA' || upper === 'GUERRA')) {
        nomeGuerra = val;
      }
      if (!email && (upper.includes('EMAIL') || upper.includes('E-MAIL'))) {
        email = val;
      }
    }

    // 3. As 5 Perguntas de Múltipla Escolha com opções pré-definidas
    let crimesCandidatos = 'Não houve';
    let crimesLocaisVotacao = 'Não houve';
    let crimesEleitorais = 'Não houve';
    let incidentesSeguranca = 'Não houve';
    let prisoesApreensoes = 'Não houve';

    for (const k of keys) {
      const upper = k.toUpperCase();
      const val = String(row[k] || '').trim();

      if (upper.includes('CONTRA CANDIDATOS') || (upper.includes('CRIMES') && upper.includes('CANDIDATO'))) {
        crimesCandidatos = val || 'Não houve';
      } else if (
        upper.includes('LOCAIS DE VOTAÇÃO') ||
        upper.includes('LOCAIS DE VOTACAO') ||
        upper.includes('APURAÇÃO') ||
        upper.includes('APURACAO')
      ) {
        crimesLocaisVotacao = val || 'Não houve';
      } else if (
        upper === 'CRIMES ELEITORAIS' ||
        (upper.includes('ELEITORAIS') && !upper.includes('COMUNS') && !upper.includes('INCIDENTES'))
      ) {
        crimesEleitorais = val || 'Não houve';
      } else if (
        upper.includes('INCIDENTES') ||
        upper.includes('DEFESA SOCIAL') ||
        (upper.includes('SEGURANÇA PÚBLICA') && upper.includes('ENTORNO'))
      ) {
        incidentesSeguranca = val || 'Não houve';
      } else if (
        upper.includes('PRISÕ') ||
        upper.includes('PRISOES') ||
        upper.includes('APREENS')
      ) {
        prisoesApreensoes = val || 'Não houve';
      }
    }

    // 4. Identificar e colecionar TODOS os crimes assinalados nas 5 perguntas (pode haver mais de um no mesmo formulário!)
    const crimesRegistrados: string[] = [];
    if (!isSemAlteracao(crimesCandidatos)) crimesRegistrados.push(crimesCandidatos);
    if (!isSemAlteracao(crimesLocaisVotacao)) crimesRegistrados.push(crimesLocaisVotacao);
    if (!isSemAlteracao(crimesEleitorais)) crimesRegistrados.push(crimesEleitorais);
    if (!isSemAlteracao(incidentesSeguranca)) crimesRegistrados.push(incidentesSeguranca);
    if (!isSemAlteracao(prisoesApreensoes)) crimesRegistrados.push(prisoesApreensoes);

    // Verificar se existe uma coluna explícita com esse nome
    for (const k of keys) {
      const upper = k.toUpperCase();
      if (
        upper.includes('SE HOUVER') ||
        upper.includes('SE HOUVER A OCORRÊNCIA') ||
        upper.includes('DIZER QUAL É') ||
        upper.includes('DIZER QUAL')
      ) {
        const val = String(row[k] || '').trim();
        if (val && !isSemAlteracao(val) && !crimesRegistrados.includes(val)) {
          crimesRegistrados.push(val);
          break;
        }
      }
    }

    const seHouverOcorrenciaDizerQual =
      crimesRegistrados.length > 0 ? crimesRegistrados.join('; ') : 'Não houve';

    let categoria = 'Crimes comuns nos locais de votação';
    if (!isSemAlteracao(crimesLocaisVotacao)) {
      categoria = 'Crimes comuns nos locais de votação';
    } else if (!isSemAlteracao(crimesCandidatos)) {
      categoria = 'Crimes comuns contra candidatos';
    } else if (!isSemAlteracao(crimesEleitorais)) {
      categoria = 'Crimes eleitorais';
    } else if (!isSemAlteracao(incidentesSeguranca)) {
      categoria = 'Incidentes de segurança pública';
    } else if (!isSemAlteracao(prisoesApreensoes)) {
      categoria = 'Prisões e apreensões no entorno';
    }

    // 5. Cabeçalhos de detalhamento do fato da planilha: LOCAL, HORA, BOPM, RO, DINÂMICA
    let local = '';
    let hora = '';
    let bopm = '';
    let ro = '';
    let dinamica = '';
    let servicoDia = '';

    for (const k of keys) {
      const upper = k.toUpperCase().trim();
      const val = String(row[k] || '').trim();
      if (!val) continue;

      if (!servicoDia && (upper.includes('SERVIÇO DO DIA') || upper.includes('SERVICO DO DIA'))) {
        servicoDia = val;
      }

      // NUNCA confundir com Endereço de e-mail!
      if (upper.includes('EMAIL') || upper.includes('E-MAIL')) continue;

      if (
        !local &&
        (upper.includes('LOCAL DA OCORRÊNCIA') ||
          upper.includes('LOCAL DA OCORRENCIA') ||
          upper.includes('LOCAL DO FATO') ||
          upper === 'LOCAL' ||
          upper.includes('LOCAL DE VOTAÇÃO') ||
          upper.includes('LOCALIDADE') ||
          (upper.includes('ENDEREÇO') && !upper.includes('EMAIL')))
      ) {
        local = val;
      }
      if (
        !hora &&
        (upper.includes('HORA DA OCORRÊNCIA') ||
          upper.includes('HORA DA OCORRENCIA') ||
          upper.includes('HORA DO FATO') ||
          upper === 'HORA' ||
          upper === 'HORÁRIO' ||
          upper === 'HORARIO')
      ) {
        hora = val;
      }
      if (!bopm && (upper.includes('BOPM') || upper.includes('BO-PM') || upper.includes('BO PM'))) {
        bopm = val;
      }
      if (
        !ro &&
        (upper === 'RO' ||
          upper.includes('R.O.') ||
          upper.includes('R.O') ||
          upper.includes('Nº RO') ||
          upper.includes('REGISTRO DE OCORRÊNCIA') ||
          upper.includes('REGISTRO DE OCORRENCIA') ||
          upper === 'DP')
      ) {
        ro = val;
      }
      if (
        !dinamica &&
        (upper.includes('DINÂMICA') ||
          upper.includes('DINAMICA') ||
          upper.includes('HISTÓRICO') ||
          upper.includes('HISTORICO') ||
          upper.includes('DESCRIÇÃO') ||
          upper.includes('RELATO'))
      ) {
        dinamica = val;
      }
    }

    // Fallbacks inteligentes se a planilha tiver campos vazios
    if (!local) local = opm ? `Área de atuação do ${opm}` : 'Local de Votação';
    if (!hora) {
      const timeMatch = carimbo.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      hora = timeMatch ? timeMatch[1] : '11:00';
    }
    if (!bopm) bopm = 'Não informado';
    if (!ro) ro = 'Não informado';
    if (!dinamica) {
      dinamica = seHouverOcorrenciaDizerQual !== 'Não houve'
        ? `${seHouverOcorrenciaDizerQual} registrado no local.`
        : 'Sem alterações registradas no local.';
    }

    const cpa = comandoIntermediario;
    const uop = opm || 'UOP';
    const tipo = seHouverOcorrenciaDizerQual;

    return {
      id: `oc-${index + 1}`,
      carimbo,
      comandoIntermediario,
      opm: uop,
      servicoDia: servicoDia || undefined,

      // Informante do Formulário Google
      posto: posto || undefined,
      rg: rg || undefined,
      nomeGuerra: nomeGuerra || undefined,
      email: email || undefined,

      // As 5 perguntas com respostas pré-definidas
      crimesCandidatos,
      crimesLocaisVotacao,
      crimesEleitorais,
      incidentesSeguranca,
      prisoesApreensoes,

      // Se houver a ocorrência, dizer qual é
      crimesRegistrados,
      seHouverOcorrenciaDizerQual,

      // Detalhamento do fato
      local,
      hora,
      bopm,
      ro,
      dinamica,

      // Compatibilidade
      cpa,
      uop,
      bairro: local,
      localidade: local,
      categoria,
      tipo,
      dataHoraFato: `${carimbo.split(' ')[0] || ''} ${hora}`.trim(),
      historico: dinamica,
      providencias: `BOPM: ${bopm} | RO: ${ro}`,
      envolvidos: 'Em apuração',
      status: seHouverOcorrenciaDizerQual === 'Não houve' ? ('SEM ALTERAÇÃO' as const) : ('CONCLUÍDA' as const),
    };
  }).filter((o) => {
    // Exclui estritamente registros do 1º Turno (03/10 e 04/10) para a base do 2º Turno
    const s = `${o.carimbo || ''} ${o.servicoDia || ''} ${o.dataHoraFato || ''} ${o.dinamica || ''}`.toLowerCase();
    const is1oTurno = (s.includes('03/10') || s.includes('03out') || s.includes('04/10') || s.includes('04out')) &&
                      !(s.includes('24/10') || s.includes('25/10') || s.includes('24out') || s.includes('25out'));
    return !is1oTurno;
  });
}

/**
 * Parser dedicado exclusivamente ao 1º Turno (03 e 04 de Outubro de 2026)
 * Mantém todos os registros de 03/10 e 04/10 sem qualquer filtro de exclusão
 */
export function parseOcorrencias1TurnoCsv(csvText: string): Ocorrencia[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  if (!result.data || result.data.length === 0) return [];

  const rows = result.data as any[];

  return rows.map((row, index) => {
    const keys = Object.keys(row);

    const carimbo = String(
      row['Carimbo de data/hora'] ||
      row['Carimbo de data e hora'] ||
      row['Data/Hora'] ||
      row['CARIMBO'] ||
      new Date().toLocaleString('pt-BR')
    ).trim();

    let comandoIntermediario = '1° CPA';
    let opm = '';
    let posto = '';
    let rg = '';
    let nomeGuerra = '';
    let email = '';

    for (const k of keys) {
      const upper = k.toUpperCase().trim();
      const val = String(row[k] || '').trim();

      if (
        upper.includes('COMANDO INTERMEDIÁRIO') ||
        upper.includes('COMANDO INTERMEDIARIO') ||
        upper === 'CPA'
      ) {
        comandoIntermediario = normalizeCpaName(val);
      }
      if (
        upper === 'OPM' ||
        upper === 'UOP' ||
        upper.includes('BATALHÃO') ||
        upper.includes('BATALHAO')
      ) {
        opm = val;
      }
      if (!posto && (upper === 'POSTO' || upper === 'GRADUAÇÃO' || upper === 'POSTO/GRADUAÇÃO')) {
        posto = val;
      }
      if (!rg && (upper === 'RG' || upper === 'MATRÍCULA' || upper === 'MATRICULA')) {
        rg = val;
      }
      if (!nomeGuerra && (upper === 'NOME DE GUERRA' || upper === 'NOME GUERRA' || upper === 'GUERRA')) {
        nomeGuerra = val;
      }
      if (!email && (upper.includes('EMAIL') || upper.includes('E-MAIL'))) {
        email = val;
      }
    }

    let crimesCandidatos = 'Não houve';
    let crimesLocaisVotacao = 'Não houve';
    let crimesEleitorais = 'Não houve';
    let incidentesSeguranca = 'Não houve';
    let prisoesApreensoes = 'Não houve';

    for (const k of keys) {
      const upper = k.toUpperCase();
      const val = String(row[k] || '').trim();

      if (upper.includes('CONTRA CANDIDATOS') || (upper.includes('CRIMES') && upper.includes('CANDIDATO'))) {
        crimesCandidatos = val || 'Não houve';
      } else if (
        upper.includes('LOCAIS DE VOTAÇÃO') ||
        upper.includes('LOCAIS DE VOTACAO') ||
        upper.includes('APURAÇÃO') ||
        upper.includes('APURACAO')
      ) {
        crimesLocaisVotacao = val || 'Não houve';
      } else if (
        upper === 'CRIMES ELEITORAIS' ||
        (upper.includes('ELEITORAIS') && !upper.includes('COMUNS') && !upper.includes('INCIDENTES'))
      ) {
        crimesEleitorais = val || 'Não houve';
      } else if (
        upper.includes('INCIDENTES') ||
        upper.includes('DEFESA SOCIAL') ||
        (upper.includes('SEGURANÇA PÚBLICA') && upper.includes('ENTORNO'))
      ) {
        incidentesSeguranca = val || 'Não houve';
      } else if (
        upper.includes('PRISÕ') ||
        upper.includes('PRISOES') ||
        upper.includes('APREENS')
      ) {
        prisoesApreensoes = val || 'Não houve';
      }
    }

    const crimesRegistrados: string[] = [];
    if (!isSemAlteracao(crimesCandidatos)) crimesRegistrados.push(crimesCandidatos);
    if (!isSemAlteracao(crimesLocaisVotacao)) crimesRegistrados.push(crimesLocaisVotacao);
    if (!isSemAlteracao(crimesEleitorais)) crimesRegistrados.push(crimesEleitorais);
    if (!isSemAlteracao(incidentesSeguranca)) crimesRegistrados.push(incidentesSeguranca);
    if (!isSemAlteracao(prisoesApreensoes)) crimesRegistrados.push(prisoesApreensoes);

    for (const k of keys) {
      const upper = k.toUpperCase();
      if (
        upper.includes('SE HOUVER') ||
        upper.includes('SE HOUVER A OCORRÊNCIA') ||
        upper.includes('DIZER QUAL É') ||
        upper.includes('DIZER QUAL')
      ) {
        const val = String(row[k] || '').trim();
        if (val && !isSemAlteracao(val) && !crimesRegistrados.includes(val)) {
          crimesRegistrados.push(val);
          break;
        }
      }
    }

    const seHouverOcorrenciaDizerQual =
      crimesRegistrados.length > 0 ? crimesRegistrados.join('; ') : 'Não houve';

    let categoria = 'Crimes comuns nos locais de votação';
    if (!isSemAlteracao(crimesLocaisVotacao)) {
      categoria = 'Crimes comuns nos locais de votação';
    } else if (!isSemAlteracao(crimesCandidatos)) {
      categoria = 'Crimes comuns contra candidatos';
    } else if (!isSemAlteracao(crimesEleitorais)) {
      categoria = 'Crimes eleitorais';
    } else if (!isSemAlteracao(incidentesSeguranca)) {
      categoria = 'Incidentes de segurança pública';
    } else if (!isSemAlteracao(prisoesApreensoes)) {
      categoria = 'Prisões e apreensões no entorno';
    }

    let local = '';
    let hora = '';
    let bopm = '';
    let ro = '';
    let dinamica = '';
    let servicoDia = '';

    for (const k of keys) {
      const upper = k.toUpperCase().trim();
      const val = String(row[k] || '').trim();
      if (!val) continue;

      if (!servicoDia && (upper.includes('SERVIÇO DO DIA') || upper.includes('SERVICO DO DIA'))) {
        servicoDia = val;
      }
      if (upper.includes('EMAIL') || upper.includes('E-MAIL')) continue;

      if (
        !local &&
        (upper.includes('LOCAL DA OCORRÊNCIA') ||
          upper.includes('LOCAL DA OCORRENCIA') ||
          upper.includes('LOCAL DO FATO') ||
          upper === 'LOCAL' ||
          upper.includes('LOCAL DE VOTAÇÃO') ||
          upper.includes('LOCALIDADE') ||
          (upper.includes('ENDEREÇO') && !upper.includes('EMAIL')))
      ) {
        local = val;
      }
      if (
        !hora &&
        (upper.includes('HORA DA OCORRÊNCIA') ||
          upper.includes('HORA DA OCORRENCIA') ||
          upper.includes('HORA DO FATO') ||
          upper === 'HORA' ||
          upper === 'HORÁRIO' ||
          upper === 'HORARIO')
      ) {
        hora = val;
      }
      if (!bopm && (upper.includes('BOPM') || upper.includes('BO-PM') || upper.includes('BO PM'))) {
        bopm = val;
      }
      if (
        !ro &&
        (upper === 'RO' ||
          upper.includes('R.O.') ||
          upper.includes('R.O') ||
          upper.includes('Nº RO') ||
          upper.includes('REGISTRO DE OCORRÊNCIA') ||
          upper.includes('REGISTRO DE OCORRENCIA') ||
          upper === 'DP')
      ) {
        ro = val;
      }
      if (
        !dinamica &&
        (upper.includes('DINÂMICA') ||
          upper.includes('DINAMICA') ||
          upper.includes('HISTÓRICO') ||
          upper.includes('HISTORICO') ||
          upper.includes('DESCRIÇÃO') ||
          upper.includes('RELATO'))
      ) {
        dinamica = val;
      }
    }

    if (!local) local = opm ? `Área de atuação do ${opm}` : 'Local de Votação';
    if (!hora) {
      const timeMatch = carimbo.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      hora = timeMatch ? timeMatch[1] : '11:00';
    }
    if (!bopm) bopm = 'Não informado';
    if (!ro) ro = 'Não informado';
    if (!dinamica) {
      dinamica = seHouverOcorrenciaDizerQual !== 'Não houve'
        ? `${seHouverOcorrenciaDizerQual} registrado no local.`
        : 'Sem alterações registradas no local.';
    }

    const cpa = comandoIntermediario;
    const uop = opm || 'UOP';
    const tipo = seHouverOcorrenciaDizerQual;

    return {
      id: `oc-1t-${index + 1}`,
      carimbo,
      comandoIntermediario,
      opm: uop,
      servicoDia: servicoDia || undefined,

      posto: posto || undefined,
      rg: rg || undefined,
      nomeGuerra: nomeGuerra || undefined,
      email: email || undefined,

      crimesCandidatos,
      crimesLocaisVotacao,
      crimesEleitorais,
      incidentesSeguranca,
      prisoesApreensoes,

      crimesRegistrados,
      seHouverOcorrenciaDizerQual,

      local,
      hora,
      bopm,
      ro,
      dinamica,

      cpa,
      uop,
      bairro: local,
      localidade: local,
      categoria,
      tipo,
      dataHoraFato: `${carimbo.split(' ')[0] || ''} ${hora}`.trim(),
      historico: dinamica,
      providencias: `BOPM: ${bopm} | RO: ${ro}`,
      envolvidos: 'Em apuração',
      status: seHouverOcorrenciaDizerQual === 'Não houve' ? ('SEM ALTERAÇÃO' as const) : ('CONCLUÍDA' as const),
    };
  });
}

export function normalizeCpaName(raw: string): string {
  if (!raw) return '1º CPA';
  const upper = raw.trim().toUpperCase();
  if (upper.includes('CPP')) return 'CPP';
  if (upper.includes('COE')) return 'COE';
  if (upper.includes('CPE')) return 'CPE';
  const match = upper.match(/([1-8])/);
  if (match) return `${match[1]}º CPA`;
  return raw.trim();
}

function isSemAlteracao(str: string): boolean {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  return (
    s === 'sem alteração' ||
    s === 'sem alteracao' ||
    s === 'sem alterações' ||
    s === 'sem alteracoes' ||
    s === 'não houve' ||
    s === 'nao houve' ||
    s === 'nenhum' ||
    s === 'nenhuma' ||
    s === '-' ||
    s === 'ok' ||
    s === 'nada consta'
  );
}

function extractPostoAndNome(raw: string): { posto: string; nome: string } {
  const trimmed = raw.trim();
  const ranks = [
    '1° SARGENTO',
    '1º SARGENTO',
    '1° SGT',
    '1º SGT',
    '2° SARGENTO',
    '2º SARGENTO',
    '2° SGT',
    '2º SGT',
    '3° SARGENTO',
    '3º SARGENTO',
    '3° SGT',
    '3º SGT',
    'SUBTENENTE PM',
    'SUBTENENTE',
    'SUBTEN PM',
    'SUBTEN',
    'SUB TEN PM',
    'SUB TEN',
    'CABO PM',
    'CABO',
    'CB PM',
    'CB',
    'SOLDADO PM',
    'SOLDADO',
    'SD PM',
    'SD',
    '1° TENENTE',
    '1º TENENTE',
    '1° TEN PM',
    '1º TEN PM',
    '1° TEN',
    '1º TEN',
    '2° TENENTE',
    '2º TENENTE',
    '2° TEN PM',
    '2º TEN PM',
    '2° TEN',
    '2º TEN',
    'TENENTE CORONEL',
    'TEN CEL PM',
    'TEN CEL',
    'TENENTE PM',
    'TENENTE',
    'TEN PM',
    'CAPITÃO PM',
    'CAPITÃO',
    'CAPITAO PM',
    'CAPITAO',
    'CAP PM',
    'MAJOR PM',
    'MAJOR',
    'MAJ PM',
    'CORONEL PM',
    'CORONEL',
    'CEL PM',
  ];

  const upper = trimmed.toUpperCase();
  for (const rank of ranks) {
    if (upper.startsWith(rank)) {
      const rest = trimmed.slice(rank.length).replace(/^[\s\-–—:]+/, '').trim();
      return { posto: rank, nome: rest || trimmed };
    }
  }

  const degreeMatch = trimmed.match(/^([1-3][°º]\s*[a-zA-Z]+)\s+(.*)$/i);
  if (degreeMatch) {
    return { posto: degreeMatch[1].toUpperCase(), nome: degreeMatch[2].trim() };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return { posto: parts[0].toUpperCase(), nome: parts.slice(1).join(' ').toUpperCase() };
  }

  return { posto: 'POLICIAL MILITAR', nome: trimmed.toUpperCase() };
}

function parsePolicialItem(text: string): {
  postoGrad: string;
  nomeGuerra: string;
  rg: string;
  opmOrigem: string;
} {
  let clean = text.trim();
  if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();

  let rg = '';
  let opmOrigem = '';
  let rawName = '';

  const rgMatch = clean.match(/RG\s*[:\-\s]*\s*([0-9\.\-]+)/i);
  if (rgMatch) {
    rg = rgMatch[1].trim();
  }

  const dashParts = clean.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);

  if (dashParts.length >= 3) {
    rawName = dashParts[0];
    if (!rg) {
      rg = dashParts[1].replace(/[^0-9\.\-]/g, '');
    }
    opmOrigem = dashParts[2];
  } else if (dashParts.length === 2) {
    rawName = dashParts[0];
    if (rgMatch) {
      opmOrigem = dashParts[1].replace(/RG\s*[:\-\s]*\s*[0-9\.\-]+/i, '').trim() || dashParts[1];
    } else {
      const maybeRg = dashParts[1].replace(/[^0-9\.\-]/g, '');
      if (maybeRg.length >= 4) {
        rg = maybeRg;
      } else {
        opmOrigem = dashParts[1];
      }
    }
  } else {
    rawName = clean.replace(/RG\s*[:\-\s]*\s*[0-9\.\-]+/i, '').trim();
  }

  const { posto, nome } = extractPostoAndNome(rawName || clean);

  return {
    postoGrad: posto,
    nomeGuerra: nome.toUpperCase(),
    rg: rg || 'A CONFIRMAR',
    opmOrigem: opmOrigem || 'OPM A APURAR',
  };
}

export function parseFaltasCsv(csvText: string): FaltaEfetivo[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  if (!result.data || result.data.length === 0) return INITIAL_FALTAS;

  const rows = result.data as any[];
  const firstRow = rows[0] || {};
  const firstRowKeys = Object.keys(firstRow).map((k) => k.toUpperCase());

  // Detecta formato Google Forms POE (com FALTAS NO POE, DISPENSAS NO POE, COMANDO INTERMEDIÁRIO, etc.)
  const isGoogleFormsPoe = firstRowKeys.some(
    (k) =>
      k.includes('FALTAS NO POE') ||
      k.includes('DISPENSAS NO POE') ||
      k.includes('COMANDO INTERMEDIÁRIO') ||
      k.includes('COMANDO INTERMEDIARIO') ||
      k.includes('SERVIÇO DO DIA') ||
      k.includes('SERVICO DO DIA')
  );

  if (isGoogleFormsPoe) {
    const list: FaltaEfetivo[] = [];

    rows.forEach((row, index) => {
      const carimbo = String(row['Carimbo de data/hora'] || row['Data/Hora'] || new Date().toLocaleString('pt-BR')).trim();
      const servicoDia = String(row['Serviço do Dia:'] || row['Serviço do Dia'] || row['SERVIÇO DO DIA'] || '').trim();
      const postoInf = String(row['Posto'] || row['POSTO'] || 'TEN PM').trim();
      const rgInf = String(row['RG'] || row['RG_INFORMANTE'] || '').trim();
      const nomeInf = String(row['Nome de Guerra'] || row['NOME_GUERRA'] || '').trim();
      const informante = [postoInf, nomeInf, rgInf ? `(RG: ${rgInf})` : ''].filter(Boolean).join(' ');

      const email = String(row['Endereço de e-mail'] || row['Endereço de email'] || row['Email'] || row['EMAIL'] || '').trim();
      const rawCpa = String(row['COMANDO INTERMEDIÁRIO'] || row['COMANDO INTERMEDIARIO'] || row['CPA'] || '2° CPA').trim();
      const cpa = normalizeCpaName(rawCpa);
      const opmDestino = String(row['OPM'] || row['UOP'] || '9º BPM').trim();

      const dataStr =
        servicoDia.includes('24OUT') || servicoDia.includes('24/10')
          ? '24/10/2026'
          : servicoDia.includes('25OUT') || servicoDia.includes('25/10')
          ? '25/10/2026'
          : '24/10/2026';
      const turnoStr = servicoDia || 'Serviço POE Eleições';

      // 1. Processar FALTAS NO POE
      const faltasKey = Object.keys(row).find((k) => k.toUpperCase().includes('FALTAS NO POE'));
      const faltasRaw = faltasKey ? String(row[faltasKey] || '').trim() : '';

      // 2. Processar DISPENSAS NO POE
      const dispensasKey = Object.keys(row).find((k) => k.toUpperCase().includes('DISPENSAS NO POE'));
      const dispensasRaw = dispensasKey ? String(row[dispensasKey] || '').trim() : '';

      list.push({
        id: `falta-resp-${index + 1}`,
        carimbo,
        servicoDia: servicoDia || turnoStr,
        posto: postoInf,
        rg: rgInf || '',
        nomeGuerra: nomeInf || '',
        comandoIntermediario: cpa,
        opm: opmDestino,
        faltasPoe: faltasRaw || 'sem alteração',
        dispensasPoe: dispensasRaw || 'sem alteração',
        email,

        // Compatibilidade
        data: dataStr,
        turno: turnoStr,
        postoGrad: postoInf,
        opmOrigem: `${cpa} / ${opmDestino}`,
        uopDestino: opmDestino,
        localVotacao: 'POE - Escala Operacional',
        motivo: faltasRaw || 'Sem alteração',
        substituto: dispensasRaw || 'sem alteração',
        status: 'REGISTRADO',
        cpa,
        tipoRegistro: 'FALTA',
        informante,
      });
    });

    if (list.length > 0) {
      return list;
    }
  }

  // Formato tradicional tabular padrão
  return rows.map((row, index) => {
    const rawCpa = String(row['COMANDO INTERMEDIÁRIO'] || row['COMANDO INTERMEDIARIO'] || row['CPA'] || '1º CPA').trim();
    const cpa = normalizeCpaName(rawCpa);
    return {
      id: `falta-${index + 1}`,
      carimbo: String(row['Carimbo de data/hora'] || row['CARIMBO'] || new Date().toLocaleString('pt-BR')).trim(),
      data: String(row['Data da Escala'] || row['DATA'] || '04/10/2026').trim(),
      turno: String(row['Turno'] || row['TURNO'] || 'DOMINGO').trim().toUpperCase(),
      postoGrad: String(row['Posto/Graduação'] || row['GRADUAÇÃO'] || row['POSTO_GRAD'] || '').trim().toUpperCase(),
      rg: String(row['RG'] || row['Matrícula'] || row['RG_PM'] || '').trim(),
      nomeGuerra: String(row['Nome de Guerra'] || row['NOME_GUERRA'] || '').trim().toUpperCase(),
      opmOrigem: String(row['OPM de Origem'] || row['OPM_ORIGEM'] || '').trim(),
      uopDestino: String(row['UOP Destino / Emprego'] || row['UOP_DESTINO'] || '').trim(),
      localVotacao: String(row['Local de Votação Designado'] || row['LOCAL_VOTACAO'] || '').trim(),
      motivo: String(row['Motivo da Falta'] || row['MOTIVO'] || row['Justificativa'] || '').trim(),
      substituto: String(row['Policial Substituto'] || row['SUBSTITUTO'] || 'AGUARDANDO').trim(),
      status: (row['Status'] || row['STATUS'] || 'PENDENTE').trim().toUpperCase() as any,
      cpa,
      comandoIntermediario: cpa,
    };
  }).filter((f) => f.nomeGuerra || f.rg);
}

export function normalizeGoogleSheetsUrl(url: string): { primary: string; fallbacks: string[] } {
  if (!url) return { primary: '', fallbacks: [] };
  const trimmed = url.trim();

  // Detecção amigável se o usuário colou o link do Formulário Google em vez da planilha de respostas
  if (trimmed.includes('docs.google.com/forms/')) {
    throw new Error(
      'Você informou o link do Formulário Google, e não da Planilha de Respostas. Para obter a planilha correta: abra o seu Formulário Google, clique na aba superior "Respostas", clique no ícone verde "Ver no Planilhas" (ou "Vincular ao Planilhas"), e copie o link da planilha aberta no navegador.'
    );
  }

  // Caso 1: Publicado na web com token 2PACX (/d/e/2PACX-...)
  const pubMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/e\/(2PACX-[a-zA-Z0-9_-]+)/);
  if (pubMatch) {
    const pubToken = pubMatch[1];
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '';
    const gidParam = gid ? `&gid=${gid}` : '';

    return {
      primary: `https://docs.google.com/spreadsheets/d/e/${pubToken}/pub?single=true&output=csv${gidParam}`,
      fallbacks: [
        `https://docs.google.com/spreadsheets/d/e/${pubToken}/pub?output=csv${gidParam}`,
      ],
    };
  }

  // Caso 2: URL de planilha do Google (/d/SPREADSHEET_ID) com suporte a /u/0/d/, /u/1/d/, etc.
  const docMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1] !== 'e') {
    const sheetId = docMatch[1];
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    // Preserva rigorosamente o gid fornecido pelo usuário (ex: aba do 2º Turno)
    const gid = gidMatch ? gidMatch[1] : '';
    const gidParam = gid ? `&gid=${gid}` : '';

    return {
      primary: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`,
      fallbacks: [
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidParam}`,
      ],
    };
  }

  // Caso 3: Links do Google Drive (drive.google.com/file/d/ID ou open?id=ID)
  const driveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const sheetId = driveMatch[1];
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '';
    const gidParam = gid ? `&gid=${gid}` : '';
    return {
      primary: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`,
      fallbacks: [
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidParam}`,
      ],
    };
  }

  return { primary: trimmed, fallbacks: [] };
}

export async function fetchCsvWithTimeout(url: string, timeoutMs = 12000): Promise<string> {
  const { primary, fallbacks } = normalizeGoogleSheetsUrl(url);
  const candidates = [primary, ...fallbacks].filter(Boolean);

  let hadLoginRedirect = false;

  const isValidCsv = (text: string) => {
    if (!text || text.trim().length < 3) return false;
    const lower = text.toLowerCase().trim();
    if (
      lower.includes('accounts.google.com') ||
      lower.includes('servicelogin') ||
      lower.includes('google doc error') ||
      lower.includes('fazer login') ||
      lower.includes('sign in - google accounts')
    ) {
      hadLoginRedirect = true;
      return false;
    }
    if (lower.startsWith('<!doctype') || lower.startsWith('<html') || lower.includes('page not found')) {
      return false;
    }
    return (
      text.includes(',') ||
      text.includes(';') ||
      text.includes('\t') ||
      text.includes('\n') ||
      text.includes('"') ||
      lower.includes('liberado') ||
      lower.includes('bloqueado')
    );
  };

  for (const candidate of candidates) {
    const sep = candidate.includes('?') ? '&' : '?';
    const cleanUrl = `${candidate}${sep}_t=${Date.now()}`;

    // 1. Tentativa via Proxy Local do Servidor (/api/proxy-sheet) - Prioritário para evitar bloqueios de CORS do navegador
    try {
      const localProxyUrl = `/api/proxy-sheet?url=${encodeURIComponent(cleanUrl)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const proxyResp = await fetch(localProxyUrl, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (proxyResp.status === 403) {
        hadLoginRedirect = true;
      } else if (proxyResp.ok) {
        const text = await proxyResp.text();
        if (text === 'GOOGLE_SHEETS_RESTRICTED') {
          hadLoginRedirect = true;
        } else if (isValidCsv(text)) {
          return text;
        }
      }
    } catch {
      // Ignorar e tentar direto / outros proxies
    }

    // 2. Tentativa Direta (funciona para planilhas publicadas na web)
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'text/csv, text/plain, */*',
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });

      clearTimeout(id);

      if (response.ok) {
        const text = await response.text();
        if (isValidCsv(text)) {
          return text;
        }
      }
    } catch {
      // Ignorar e tentar proxies públicos
    }

    // 3. Tentativa via Proxy CORS 1 (AllOrigins)
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const proxyResponse = await fetch(proxyUrl, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (proxyResponse.ok) {
        const text = await proxyResponse.text();
        if (isValidCsv(text)) {
          return text;
        }
      }
    } catch {
      // Ignorar e tentar próximo
    }

    // 4. Tentativa via Proxy CORS 2 (CorsProxy)
    try {
      const proxyUrl2 = `https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const proxyResponse2 = await fetch(proxyUrl2, {
        signal: controller.signal,
      });
      clearTimeout(id);

      if (proxyResponse2.ok) {
        const text = await proxyResponse2.text();
        if (isValidCsv(text)) {
          return text;
        }
      }
    } catch {
      // Ignorar e tentar próximo
    }
  }

  if (hadLoginRedirect) {
    throw new Error(
      'A planilha do Google está com ACESSO RESTRITO. Para liberar o acesso do sistema: abra a planilha no Google Sheets, clique no botão azul "Compartilhar" (no canto superior direito) e mude de "Restrito" para "Qualquer pessoa com o link" (Leitor).'
    );
  }

  throw new Error(
    'Não foi possível ler os dados da planilha Google Sheets. Verifique se o link está acessível no Google Drive e compartilhado com permissão de Leitura.'
  );
}

export const StorageService = {
  getLocais(): LocalVotacao[] {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.LOCAIS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 4000) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler cache de locais:', e);
    }
    const initial = parseLocaisCsv(RAW_PLANILHA_GERAL_DASH_CSV);
    this.saveLocais(initial);
    return initial;
  },

  saveLocais(data: LocalVotacao[]) {
    try {
      localStorage.setItem(CACHE_KEYS.LOCAIS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar locais no localStorage:', e);
    }
  },

  getOcorrencias(): Ocorrencia[] {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.OCORRENCIAS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (o: Ocorrencia) => !o.local?.includes('Edgard Romero') && !o.dinamica?.includes('Vidro da janela')
          );
        }
      }
    } catch (e) {
      console.error('Erro ao ler cache de ocorrencias:', e);
    }
    return [];
  },

  saveOcorrencias(data: Ocorrencia[]) {
    try {
      localStorage.setItem(CACHE_KEYS.OCORRENCIAS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar ocorrencias no localStorage:', e);
    }
  },

  getFaltas(): FaltaEfetivo[] {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.FALTAS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('Erro ao ler cache de faltas:', e);
    }
    this.saveFaltas(INITIAL_FALTAS);
    return INITIAL_FALTAS;
  },

  saveFaltas(data: FaltaEfetivo[]) {
    try {
      localStorage.setItem(CACHE_KEYS.FALTAS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar faltas no localStorage:', e);
    }
  },

  getLastSync(): string | null {
    return localStorage.getItem(CACHE_KEYS.LAST_SYNC);
  },

  setLastSync(timeStr: string) {
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, timeStr);
  },
};
