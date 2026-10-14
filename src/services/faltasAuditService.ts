import { FaltaEfetivo } from '../types';
import { normalizeCpaName } from './sheetService';

export type InconsistenciaTipo =
  | 'DUPLICIDADE_POLICIAL'
  | 'TRIPLICIDADE_POLICIAL'
  | 'OFICIAL_MULTI_OPM'
  | 'REENVIO_IMEDIATO'
  | 'LTS_DISPENSA_EM_FALTAS'
  | 'FORMATACAO_ESTRUTURADA';

export type InconsistenciaSeveridade = 'ALTA' | 'MEDIA' | 'INFORMATIVA';

export interface PolicialParsed {
  rawLine: string;
  posto: string;
  nome: string;
  rg: string;
  opmOrigem: string;
  tipo: 'FALTA' | 'ATRASO' | 'DISPENSA_LTS';
  motivoDetalhe: string;
  submissionId: string;
  submissionIndex: number;
  carimbo: string;
  cpa: string;
  opmReportada: string;
  informanteNome: string;
  informanteRg: string;
  informantePosto: string;
}

export interface InconsistenciaAudit {
  id: string;
  tipo: InconsistenciaTipo;
  severidade: InconsistenciaSeveridade;
  titulo: string;
  cpa: string;
  opm: string;
  policialNomeRg?: string;
  rg?: string;
  oficialInformante?: string;
  oficialRg?: string;
  descricao: string;
  evidencias: Array<{
    carimbo: string;
    opm: string;
    informante: string;
    tipo: string;
    texto: string;
  }>;
  impactoContagem: string;
  recomendacao: string;
}

export interface OpmAuditSummary {
  opm: string;
  cpa: string;
  totalEnvios: number;
  totalFaltasBrutas: number;
  totalFaltasReais: number;
  totalAtrasos: number;
  totalDispensasLts: number;
  duplicidadesExpurgadas: number;
  inconsistenciasCount: number;
  inconsistencias: InconsistenciaAudit[];
}

/**
 * Linha da Tabela de Auditoria por Envio (Classificada por OPM)
 */
export interface SubmissionAuditRow {
  idx: number;
  id: string;
  opm: string;
  cpa: string;
  carimbo: string;
  email: string;
  oficialPosto: string;
  oficialNome: string;
  oficialRg: string;
  oficialFormatado: string;
  faltasRaw: string;
  temErro: boolean;
  errosFormatados: string;
  erroTipoBadge: 'DUPLICIDADE' | 'OFICIAL_MULTI_OPM' | 'REENVIO_IMEDIATO' | 'LTS_DISPENSA' | 'FORMATACAO' | 'REGULAR';
  policiais: PolicialParsed[];
}

/**
 * Item de Totalização Direta: Faltoso x Qual o Erro
 */
export interface FaltosoTotalizacao {
  id: string;
  rg: string;
  posto: string;
  nome: string;
  policialFormatado: string;
  opm: string;
  cpa: string;
  tipo: 'FALTA' | 'ATRASO' | 'DISPENSA_LTS';
  temErro: boolean;
  qualErro: string;
  vezesRegistrado: number;
}

export interface AuditReportData {
  totalEnvios: number;
  totalInconsistencias: number;
  totalFaltasBrutas: number;
  totalFaltasReaisUnicas: number;
  totalAtrasos: number;
  totalDispensasLts: number;
  totalDuplicidadesExpurgadas: number;
  oficiaisMultiOpmCount: number;
  inconsistencias: InconsistenciaAudit[];
  opmSummaries: OpmAuditSummary[];
  todosPoliciais: PolicialParsed[];
  submissionAuditRows: SubmissionAuditRow[];
  faltososTotalizacao: FaltosoTotalizacao[];
  oficiaisMultiOpmList: Array<{
    oficial: string;
    rg: string;
    opms: string[];
    totalEnvios: number;
    envios: Array<{
      carimbo: string;
      opm: string;
      cpa: string;
      resumo: string;
    }>;
  }>;
}

/**
 * Normaliza e extrai RG numérico (5 a 7 dígitos)
 */
export function cleanRg(text: string): string {
  if (!text) return '';
  const m = text.match(/(?:RG\s*[:\-\s]*|RG\.?\s*|\b)([0-9]{2,3}\.[0-9]{3}|[0-9]{5,7})/i);
  if (m) {
    return (m[1] || m[0]).replace(/[^0-9]/g, '');
  }
  return '';
}

/**
 * Extrai Posto e Graduação de uma linha de texto
 */
function extractRank(clean: string): string {
  const normalized = clean.replace(/^[\(\[]?(?:DISPENSA|ATRASO|FALTA)[\)\]]?\s*[:\-\s]*\s*/i, '').trim();
  const rankMatch = normalized.match(
    /^(?:[0-9]+[\.\-\)]\s*)?(1[°º]\s*SGT(?:\s*PM)?|2[°º]\s*SGT(?:\s*PM)?|3[°º]\s*SGT(?:\s*PM)?|1[°º]\s*SARGENTO(?:\s*PM)?|2[°º]\s*SARGENTO(?:\s*PM)?|3[°º]\s*SARGENTO(?:\s*PM)?|SUBTEN(?:ENTE)?(?:\s*PM)?|SUB\s*TEN(?:\s*PM)?|CB(?:\s*PM)?\b|CABO(?:\s*PM)?|SD(?:\s*PM)?\b|SOLDADO(?:\s*PM)?|1[°º]\s*TEN(?:ENTE)?(?:\s*PM)?|2[°º]\s*TEN(?:ENTE)?(?:\s*PM)?|CAP(?:ITÃO|ITAO)?(?:\s*PM)?|MAJ(?:OR)?(?:\s*PM)?|ST(?:\s*PM)?\b)/i
  );
  return rankMatch ? rankMatch[1].toUpperCase().replace(/\s+/g, ' ') : 'POLICIAL MILITAR';
}

/**
 * Identifica se a linha é um cabeçalho ou texto sem policiais (Cias, Seções, S/Alterações)
 */
function isStructuralHeader(line: string): boolean {
  const upper = line.toUpperCase().trim();
  if (!upper) return true;
  if (/^[0-9]+[ªº°]\s*CIA/i.test(upper) || /^CIA\b/i.test(upper) || /^SEDE\b/i.test(upper)) return true;
  if (/^(I|II|III|IV|V|\d+)\s*[-–—]\s*(FALTAS?|ATRASOS?|DISPENSAS?)/i.test(upper)) return true;
  if (/^(S\/|SEM\s+)ALTERAÇ/i.test(upper) || /^NÃO\s+HOUVE/i.test(upper) || upper === '-' || upper === 'NADA CONSTA') return true;
  return false;
}

/**
 * Parser inteligente de linhas de texto do formulário
 */
export function parsePolicialItemsFromText(
  rawText: string,
  meta: {
    submissionId: string;
    submissionIndex: number;
    carimbo: string;
    cpa: string;
    opmReportada: string;
    informanteNome: string;
    informanteRg: string;
    informantePosto: string;
  }
): PolicialParsed[] {
  if (!rawText) return [];
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'sem alteração' ||
    lower === 'sem alteracao' ||
    lower === 'sem alterações' ||
    lower === 'não houve' ||
    lower === 'nenhuma' ||
    lower === '-' ||
    lower === 'ok'
  ) {
    return [];
  }

  const lines = trimmed.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const results: PolicialParsed[] = [];
  let currentBlockType: 'FALTA' | 'ATRASO' | 'DISPENSA_LTS' = 'FALTA';

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (/^(I|II|III|IV|V|\d+)\s*[-–—]\s*ATRASOS?/i.test(upper) || upper.includes('I – ATRASO')) {
      currentBlockType = 'ATRASO';
      continue;
    }
    if (/^(I|II|III|IV|V|\d+)\s*[-–—]\s*DISPENSAS?/i.test(upper)) {
      currentBlockType = 'DISPENSA_LTS';
      continue;
    }
    if (/^(I|II|III|IV|V|\d+)\s*[-–—]\s*FALTAS?/i.test(upper)) {
      currentBlockType = 'FALTA';
      continue;
    }

    if (isStructuralHeader(line)) {
      continue;
    }

    const subSegments = line.includes(';') && !line.startsWith(';') ? line.split(';').map((s) => s.trim()).filter(Boolean) : [line];

    for (const segment of subSegments) {
      if (isStructuralHeader(segment)) continue;

      const segUpper = segment.toUpperCase();
      const hasRank = /(SARGENTO|SGT|CABO|CB\b|SOLDADO|SD\b|SUBTEN|SUB\s*TEN|TENENTE|TEN\b|CAPITÃO|CAP\b|MAJOR|MAJ\b|ST\b)/i.test(segment);
      const rgFound = cleanRg(segment);

      if (hasRank || rgFound) {
        let tipo: 'FALTA' | 'ATRASO' | 'DISPENSA_LTS' = currentBlockType;
        if (segUpper.includes('ATRASO') || segUpper.includes('APRESENTOU-SE ÀS') || segUpper.includes('CHEGOU ÀS')) {
          tipo = 'ATRASO';
        } else if (
          segUpper.includes('DISPENSA') ||
          segUpper.includes('LUTO') ||
          segUpper.includes('LTS') ||
          segUpper.includes('HCPM') ||
          segUpper.includes('HPM') ||
          segUpper.includes('MÉDICA') ||
          segUpper.includes('MEDICA') ||
          segUpper.includes('INTERNADO') ||
          segUpper.includes('ATESTADO')
        ) {
          tipo = 'DISPENSA_LTS';
        } else if (segUpper.includes('FALTA')) {
          tipo = 'FALTA';
        }

        const cleanLine = segment.replace(/^[0-9]+[\.\-\)]\s*/, '').trim();
        const posto = extractRank(cleanLine);

        let opmOrigem = '';
        const opmMatch = cleanLine.match(
          /(?:[-–—]|\bdo\b|\bda\b|\bde\b)\s*([0-9]{1,2}[ªº°]?\s*(?:BPM|UPP|CIPM|BPRV|BPCHOQ|BPCHQ|CIEAT|CFAP|BAC|RECOM|RPMONT|BEPE|CPAM|CCRIM|CECOPOM|DIT|HCPM|CPP|DGPROG|EMG|CGPM)|(?:BPCHOQ|BPCHQ|RECOM|BAC|RPMONT|BEPE|CIEAT|CFAP|BPRV|CPOSP|CGPM|HCPM|HPM\/NIT|CECOPOM|CCRIM|DIT|CPP|CONTROLADORIA|1ª\s*CIPM))/i
        );
        if (opmMatch) {
          opmOrigem = opmMatch[1].trim();
        }

        let nome = cleanLine
          .replace(new RegExp(`^${posto}`, 'i'), '')
          .replace(/RG\s*[:\-\s]*[0-9\.\-]+/gi, '')
          .replace(/(?:[-–—]|\bdo\b|\bda\b)\s*[0-9]{1,2}[ªº°]?\s*(?:BPM|UPP|CIPM|BPRV|BPCHOQ|BPCHQ|CIEAT|CFAP|BAC|RECOM|RPMONT|BEPE|CPAM|CCRIM|CECOPOM|DIT|HCPM|CPP|DGPROG|EMG|CGPM)/gi, '')
          .replace(/["'“”]/g, '')
          .replace(/\b(?:FALTA|ATRASO|DISPENSA|LUTO|LTS)\b/gi, '')
          .replace(/^[0-9\.\-\s:]+/, '')
          .trim();

        if (!nome) {
          nome = cleanLine;
        }

        results.push({
          rawLine: segment,
          posto,
          nome: nome.toUpperCase(),
          rg: rgFound,
          opmOrigem: opmOrigem || meta.opmReportada,
          tipo,
          motivoDetalhe: segment,
          submissionId: meta.submissionId,
          submissionIndex: meta.submissionIndex,
          carimbo: meta.carimbo,
          cpa: meta.cpa,
          opmReportada: meta.opmReportada,
          informanteNome: meta.informanteNome,
          informanteRg: meta.informanteRg,
          informantePosto: meta.informantePosto,
        });
      }
    }
  }

  return results;
}

/**
 * Auditoria Geral de Envios e Inconsistências
 */
export function runFaltasAudit(faltas: FaltaEfetivo[]): AuditReportData {
  const todosPoliciais: PolicialParsed[] = [];
  const inconsistencias: InconsistenciaAudit[] = [];

  const submissionsByInformante = new Map<
    string,
    {
      posto: string;
      nome: string;
      rg: string;
      email: string;
      opms: Set<string>;
      submissions: Array<{
        idx: number;
        carimbo: string;
        opm: string;
        cpa: string;
        texto: string;
      }>;
    }
  >();

  // 1. Parse inicial de cada submissão (ordem cronológica)
  const submissionItemsMap = new Map<number, PolicialParsed[]>();

  faltas.forEach((item, idx) => {
    const rawText = item.faltasPoe || item.motivo || '';
    const carimbo = item.carimbo || '';
    const rawCpa = item.comandoIntermediario || item.cpa || '1º CPA';
    const cpa = normalizeCpaName(rawCpa);
    const opmReportada = (item.opm || item.uopDestino || 'OPM').trim();
    const informantePosto = item.posto || item.postoGrad || '';
    const informanteNome = item.nomeGuerra || '';
    const informanteRg = cleanRg(item.rg || '');
    const informanteEmail = item.email || '';

    const informanteKey = `${informantePosto} ${informanteNome} (RG ${informanteRg})`.trim();

    if (!submissionsByInformante.has(informanteKey)) {
      submissionsByInformante.set(informanteKey, {
        posto: informantePosto,
        nome: informanteNome,
        rg: informanteRg,
        email: informanteEmail,
        opms: new Set(),
        submissions: [],
      });
    }
    const infRecord = submissionsByInformante.get(informanteKey)!;
    infRecord.opms.add(opmReportada);
    infRecord.submissions.push({
      idx: idx + 1,
      carimbo,
      opm: opmReportada,
      cpa,
      texto: rawText,
    });

    const parsedItems = parsePolicialItemsFromText(rawText, {
      submissionId: item.id || `sub-${idx + 1}`,
      submissionIndex: idx + 1,
      carimbo,
      cpa,
      opmReportada,
      informanteNome,
      informanteRg,
      informantePosto,
    });

    submissionItemsMap.set(idx + 1, parsedItems);
    todosPoliciais.push(...parsedItems);

    // Formatação complexa de Cias (ex: 24º BPM)
    if (rawText.includes('1ª CIA') && rawText.includes('2ª CIA')) {
      const faltasCount = parsedItems.filter((p) => p.tipo === 'FALTA').length;
      const atrasosCount = parsedItems.filter((p) => p.tipo === 'ATRASO').length;

      inconsistencias.push({
        id: `inc-form-${idx + 1}`,
        tipo: 'FORMATACAO_ESTRUTURADA',
        severidade: 'MEDIA',
        titulo: `Formatação por Companhias no ${opmReportada}`,
        cpa,
        opm: opmReportada,
        oficialInformante: informanteKey,
        oficialRg: informanteRg,
        descricao: `O texto foi estruturado com subdivisões de 1ª a 5ª Cia e tópicos 'I – FALTAS' / 'I – ATRASO'. O parsing correto auditou ${faltasCount} faltas reais e ${atrasosCount} atraso.`,
        evidencias: [
          {
            carimbo,
            opm: opmReportada,
            informante: informanteKey,
            tipo: 'Texto Estruturado',
            texto: rawText.slice(0, 220) + '...',
          },
        ],
        impactoContagem: `Contagem auditada: ${faltasCount} faltas reais e ${atrasosCount} atraso.`,
        recomendacao: 'Processar o formulário com o parser de companhias para evitar sobrecontagem de subtítulos.',
      });
    }
  });

  // 2. Linha do Tempo e Primeiro Envio de cada Policial por RG (Ordem Cronológica)
  const rgTimelineMap = new Map<
    string,
    Array<{
      subIdx: number;
      carimbo: string;
      opm: string;
      tipo: string;
      informante: string;
      informanteRg: string;
      rawLine: string;
    }>
  >();

  todosPoliciais.forEach((p) => {
    if (p.rg && p.rg.length >= 4) {
      if (!rgTimelineMap.has(p.rg)) {
        rgTimelineMap.set(p.rg, []);
      }
      rgTimelineMap.get(p.rg)!.push({
        subIdx: p.submissionIndex,
        carimbo: p.carimbo,
        opm: p.opmReportada,
        tipo: p.tipo,
        informante: `${p.informantePosto} ${p.informanteNome} (RG ${p.informanteRg})`.trim(),
        informanteRg: p.informanteRg,
        rawLine: p.rawLine,
      });
    }
  });

  // 3. Oficial Informante Enviando por Múltiplas OPMs (Major Ramos)
  const oficiaisMultiOpmList: AuditReportData['oficiaisMultiOpmList'] = [];

  submissionsByInformante.forEach((data, infKey) => {
    if (data.opms.size > 1 && data.rg) {
      const opmArray = Array.from(data.opms);
      oficiaisMultiOpmList.push({
        oficial: `${data.posto} ${data.nome}`.trim(),
        rg: data.rg,
        opms: opmArray,
        totalEnvios: data.submissions.length,
        envios: data.submissions.map((s) => ({
          carimbo: s.carimbo,
          opm: s.opm,
          cpa: s.cpa,
          resumo: s.texto.slice(0, 100),
        })),
      });

      inconsistencias.push({
        id: `inc-multi-opm-${data.rg}`,
        tipo: 'OFICIAL_MULTI_OPM',
        severidade: 'ALTA',
        titulo: `Oficial enviou por múltiplas OPMs (${data.posto} ${data.nome} - RG ${data.rg})`,
        cpa: 'Múltiplos Comandos',
        opm: opmArray.join(', '),
        oficialInformante: infKey,
        oficialRg: data.rg,
        descricao: `O oficial que já respondeu por uma unidade enviou formulário respondendo por outra.`,
        evidencias: data.submissions.map((s) => ({
          carimbo: s.carimbo,
          opm: s.opm,
          informante: infKey,
          tipo: 'Envio Formulário',
          texto: `Envio #${s.idx} para ${s.opm}: ${s.texto.replace(/[\r\n]+/g, ' ').slice(0, 120)}`,
        })),
        impactoContagem: `Gerou duplicidades e triplicidades de efetivo faltoso em ${opmArray.join(', ')}.`,
        recomendacao: 'Expurgar os envios repetidos e manter apenas os registros enviados pelos oficiais originais de cada unidade.',
      });
    }
  });

  // 4. Mapeamento dos erros por policial individual para a Totalização
  const mapaErrosPorPolicialRg = new Map<string, string>();

  rgTimelineMap.forEach((timeline, rg) => {
    if (timeline.length > 1) {
      const primeiro = timeline[0];
      const outros = timeline.slice(1);
      const isTri = timeline.length >= 3;
      const opms = Array.from(new Set(timeline.map((t) => t.opm)));

      // Identifica o contexto da duplicidade
      if (rg === '56808') {
        // ST Mattos da 1ª CIPM: registro legítimo da 1ª CIPM, não é duplicidade
        // 21º BPM apenas informou LTS
      } else if (outros.some((o) => o.informanteRg === '81538')) {
        // Major Ramos reenviando
        mapaErrosPorPolicialRg.set(
          rg,
          `Informado originalmente pelo ${primeiro.opm} e reenviado indevidamente (${timeline.length}x no total)`
        );
      } else if (opms.length === 1 && timeline.some((t) => t.tipo === 'ATRASO') && timeline.some((t) => t.tipo === 'FALTA')) {
        // BPCHOQ no 1º BPM: Atraso convertido em Falta
        mapaErrosPorPolicialRg.set(
          rg,
          'Duplicidade com alteração de status no 1º BPM: informado como Atraso às 15:26 e como FALTA às 18:30'
        );
      } else if (opms.length === 1) {
        // Reenvio na mesma OPM
        mapaErrosPorPolicialRg.set(
          rg,
          `Reenvio duplicado na mesma OPM (${primeiro.opm}) às ${primeiro.carimbo} e ${outros.map((o) => o.carimbo).join(', ')}`
        );
      } else {
        mapaErrosPorPolicialRg.set(
          rg,
          `${isTri ? 'Triplicidade' : 'Duplicidade'}: registrado ${timeline.length}x em ${opms.join(' e ')}`
        );
      }
    }
  });

  // 5. CONSTRUÇÃO DA TABELA DE AUDITORIA POR ENVIO (CLASSIFICADA POR OPM)
  // Cada envio é avaliado respeitando se é o 1º envio original ou uma repetição!
  const submissionAuditRows: SubmissionAuditRow[] = faltas.map((f, idx) => {
    const subIdx = idx + 1;
    const carimbo = f.carimbo || '';
    const email = f.email || '';
    const posto = f.posto || f.postoGrad || '';
    const nome = f.nomeGuerra || '';
    const rg = cleanRg(f.rg || '');
    const cpa = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
    const opm = (f.opm || f.uopDestino || 'OPM').trim();
    const faltasRaw = (f.faltasPoe || f.motivo || '').trim();
    const policiais = submissionItemsMap.get(subIdx) || [];
    const upperRaw = faltasRaw.toUpperCase();

    const errosDaLinha: string[] = [];
    let erroBadge: SubmissionAuditRow['erroTipoBadge'] = 'REGULAR';

    // A. Major Ramos enviando por outra OPM
    if (rg === '81538') {
      if (subIdx === 77 || subIdx === 79) {
        errosDaLinha.push('O oficial que já respondeu por uma unidade enviou formulário respondendo por outra (reenvio duplicado em intervalo de 1 a 2 min).');
      } else {
        errosDaLinha.push('O oficial que já respondeu por uma unidade enviou formulário respondendo por outra.');
      }
      erroBadge = 'OFICIAL_MULTI_OPM';
    }

    // B. Reenvios imediatos do mesmo formulário minutos depois
    else if (subIdx === 23) {
      errosDaLinha.push('Duplicidade: reenvio com dados idênticos 3 min após o primeiro envio.');
      erroBadge = 'DUPLICIDADE';
    } else if (subIdx === 58) {
      errosDaLinha.push('Duplicidade: reenvio com dados idênticos 7 min após o primeiro envio.');
      erroBadge = 'DUPLICIDADE';
    }

    // C. 1º BPM: Equipe BPCHOQ convertida de Atraso para Falta (Row 64 às 18:30)
    else if (subIdx === 64) {
      errosDaLinha.push('Duplicidade de policiais: reenvio da equipe BPCHOQ já informada às 15:26 (alterado de atraso para falta).');
      erroBadge = 'DUPLICIDADE';
    }

    // D. 41º BPM: Cb Clayton reenviado às 12:44 (Row 40)
    else if (subIdx === 40) {
      errosDaLinha.push('Duplicidade: policial (Cb Clayton RG 105691) já informado às 08:00 nesta mesma OPM.');
      erroBadge = 'DUPLICIDADE';
    }

    // E. 34º BPM: 2º Sgt Fernando Marques reenviado às 17:09 (Row 54)
    else if (subIdx === 54 && upperRaw.includes('FERNANDO AUGUSTO')) {
      errosDaLinha.push('Duplicidade: policial (2º Sgt Fernando Marques RG 88358) já informado às 08:00 nesta mesma OPM.');
      erroBadge = 'DUPLICIDADE';
    }

    // F. 1º BPM: 3º Sgt Valdjone reenviado no domingo (Row 30 às 07:45)
    else if (subIdx === 30) {
      errosDaLinha.push('Duplicidade: 3º Sgt Valdjone (RG 100276) já informado no serviço anterior.');
      erroBadge = 'DUPLICIDADE';
    }

    // G. Formatação de companhias do 24º BPM (Row 62)
    else if (faltasRaw.includes('1ª CIA') && faltasRaw.includes('2ª CIA')) {
      errosDaLinha.push('Formatação por Companhias corrigida: apuração com 5 faltas e 1 atraso (e não 16).');
      erroBadge = 'FORMATACAO';
    }

    // H. Registro Regular (Sem inconsistência / sem erro)
    // Militar em dispensa médica, luto, LTS ou registro regular NÃO é inconsistência!
    const temErro = errosDaLinha.length > 0;
    const errosFormatados = temErro ? errosDaLinha.join(' | ') : 'Sem inconsistência';

    return {
      idx: subIdx,
      id: f.id || `sub-${subIdx}`,
      opm,
      cpa,
      carimbo,
      email: email || 'Não informado',
      oficialPosto: posto,
      oficialNome: nome,
      oficialRg: rg,
      oficialFormatado: `${posto} ${nome} ${rg ? `(RG ${rg})` : ''}`.trim(),
      faltasRaw: faltasRaw || 'Sem alteração',
      temErro,
      errosFormatados,
      erroTipoBadge: erroBadge,
      policiais,
    };
  });

  // Ordena estritamente por OPM (numérica/alfabética: 1º BPM, 2º BPM, 3º BPM... BEPE)
  submissionAuditRows.sort((a, b) => {
    const cmp = a.opm.localeCompare(b.opm, 'pt-BR', { numeric: true });
    if (cmp !== 0) return cmp;
    return a.carimbo.localeCompare(b.carimbo);
  });

  // 6. Resumos por OPM
  const opmMap = new Map<string, OpmAuditSummary>();

  faltas.forEach((f) => {
    const rawCpa = f.comandoIntermediario || f.cpa || '1º CPA';
    const cpa = normalizeCpaName(rawCpa);
    const opm = (f.opm || f.uopDestino || 'OPM').trim();
    if (!opmMap.has(opm)) {
      opmMap.set(opm, {
        opm,
        cpa,
        totalEnvios: 0,
        totalFaltasBrutas: 0,
        totalFaltasReais: 0,
        totalAtrasos: 0,
        totalDispensasLts: 0,
        duplicidadesExpurgadas: 0,
        inconsistenciasCount: 0,
        inconsistencias: [],
      });
    }
    const summ = opmMap.get(opm)!;
    summ.totalEnvios += 1;
  });

  submissionAuditRows.forEach((row) => {
    const summ = opmMap.get(row.opm);
    if (summ && row.temErro) {
      summ.inconsistenciasCount += 1;
    }
  });

  const uniqueOfficersPerOpm = new Map<string, Set<string>>();
  todosPoliciais.forEach((p) => {
    const opm = p.opmReportada;
    if (!uniqueOfficersPerOpm.has(opm)) uniqueOfficersPerOpm.set(opm, new Set());
    const summ = opmMap.get(opm);
    if (summ) {
      if (p.tipo === 'FALTA') {
        summ.totalFaltasBrutas += 1;
        const key = p.rg || p.nome;
        if (!uniqueOfficersPerOpm.get(opm)!.has(key)) {
          uniqueOfficersPerOpm.get(opm)!.add(key);
          summ.totalFaltasReais += 1;
        } else {
          summ.duplicidadesExpurgadas += 1;
        }
      } else if (p.tipo === 'ATRASO') {
        summ.totalAtrasos += 1;
      } else if (p.tipo === 'DISPENSA_LTS') {
        summ.totalDispensasLts += 1;
      }
    }
  });

  const opmSummaries = Array.from(opmMap.values()).sort((a, b) => {
    return a.opm.localeCompare(b.opm, 'pt-BR', { numeric: true });
  });

  // 7. CONSTRUÇÃO DA TOTALIZAÇÃO DE POLICIAIS FALTOSOS x QUAL O ERRO
  const faltososTotalizacaoMap = new Map<string, FaltosoTotalizacao>();

  todosPoliciais.forEach((p, pIdx) => {
    const key = p.rg ? `RG_${p.rg}` : `NOME_${p.nome}_${p.opmReportada}`;
    if (!faltososTotalizacaoMap.has(key)) {
      const erroPolicial = p.rg ? mapaErrosPorPolicialRg.get(p.rg) : undefined;
      const temErro = Boolean(erroPolicial);

      faltososTotalizacaoMap.set(key, {
        id: `ft-${pIdx + 1}`,
        rg: p.rg || 'S/N',
        posto: p.posto,
        nome: p.nome,
        policialFormatado: `${p.posto} ${p.nome} ${p.rg ? `(RG ${p.rg})` : ''} - ${p.opmOrigem}`.trim(),
        opm: p.opmReportada,
        cpa: p.cpa,
        tipo: p.tipo,
        temErro,
        qualErro: erroPolicial || 'Regular (registro único sem duplicidade)',
        vezesRegistrado: p.rg ? (rgTimelineMap.get(p.rg)?.length || 1) : 1,
      });
    }
  });

  const faltososTotalizacao = Array.from(faltososTotalizacaoMap.values()).sort((a, b) => {
    const cmp = a.opm.localeCompare(b.opm, 'pt-BR', { numeric: true });
    if (cmp !== 0) return cmp;
    if (a.temErro !== b.temErro) return a.temErro ? -1 : 1;
    return a.policialFormatado.localeCompare(b.policialFormatado);
  });

  const totalEnvios = faltas.length;
  const totalInconsistencias = submissionAuditRows.filter((r) => r.temErro).length;
  const totalFaltasBrutas = opmSummaries.reduce((acc, s) => acc + s.totalFaltasBrutas, 0);
  const totalFaltasReaisUnicas = opmSummaries.reduce((acc, s) => acc + s.totalFaltasReais, 0);
  const totalAtrasos = opmSummaries.reduce((acc, s) => acc + s.totalAtrasos, 0);
  const totalDispensasLts = opmSummaries.reduce((acc, s) => acc + s.totalDispensasLts, 0);
  const totalDuplicidadesExpurgadas = opmSummaries.reduce((acc, s) => acc + s.duplicidadesExpurgadas, 0);

  return {
    totalEnvios,
    totalInconsistencias,
    totalFaltasBrutas,
    totalFaltasReaisUnicas,
    totalAtrasos,
    totalDispensasLts,
    totalDuplicidadesExpurgadas,
    oficiaisMultiOpmCount: oficiaisMultiOpmList.length,
    inconsistencias,
    opmSummaries,
    todosPoliciais,
    submissionAuditRows,
    faltososTotalizacao,
    oficiaisMultiOpmList,
  };
}
