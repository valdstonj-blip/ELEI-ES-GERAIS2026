import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';
import { isSim } from './sheetService';

/**
 * Normaliza o nome do CPA de forma consistente (1º CPA, 2º CPA, ..., 8º CPA, CPP)
 */
function normalizeCpaName(raw: string): string {
  if (!raw) return '1º CPA';
  const upper = raw.trim().toUpperCase();
  if (upper.includes('CPP')) return 'CPP';
  const match = upper.match(/([1-8])/);
  if (match) return `${match[1]}º CPA`;
  return raw.trim();
}

/**
 * Aplica cabeçalho e rodapé limpos, técnicos e corporativos da Seção de Planejamento EMG-PM/3
 * NÃO inclui 'Governo do Estado' nem 'Polícia Militar'.
 * Usa apenas 'EMG-PM/3 — SEÇÃO DE PLANEJAMENTO / OPERAÇÕES' e 'RELATÓRIO • ELEIÇÕES 2026'.
 */
function applyReportHeaderAndFooter(
  doc: jsPDF,
  title: string,
  subtitle?: string,
  subsystemLabel: string = 'RELATÓRIO DE GESTÃO E ACOMPANHAMENTO DE LOCAIS'
) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // ==========================================
    // CABEÇALHO LIMPO E DISCRETO (EMG-PM/3)
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('EMG-PM/3 — PLANEJAMENTO ELEIÇÕES GERAIS 2026', pageWidth / 2, 8.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(subsystemLabel, pageWidth / 2, 12.5, { align: 'center' });

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42); // slate-900
      const fullTitle = subtitle ? `${title.toUpperCase()} • ${subtitle}` : title.toUpperCase();
      doc.text(fullTitle, 10, 16.5);
    }

    // Linha divisória sutil perfeitamente separada
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(10, 18, pageWidth - 10, 18);

    // ==========================================
    // RODAPÉ DISCRETO NO CANTO (Dev.Fiel.26)
    // ==========================================
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400 discreto

    // Apenas 'Dev.Fiel.26' de forma discreta no canto
    doc.text('Dev.Fiel.26', 10, pageHeight - 5.5);

    const pageStr = `Página ${i} de ${pageCount}`;
    doc.text(pageStr, pageWidth - 10, pageHeight - 5.5, { align: 'right' });
  }
}

/**
 * Exporta o Relatório de Locais de Votação (Aba Planilha Geral Dash)
 * Responde diretamente às perguntas solicitadas pelo operador:
 * 1. Locais de Votação
 * 2. CPA selecionado (ou todos)
 * 3. Áreas Sensíveis
 * 4. Implantação da Urna no Domingo
 * 5. Utilização do Blindado para Implantação da Urna (Sim/Não)
 * 6. Eleitores Aptos
 * 7. Status do Evento: Urna Implantada no Local (Sim/Não) e Desmobilização (Sim/Não)
 * (Informações de efetivo 03OUT e 04OUT retiradas conforme determinação do operador)
 */
export function exportLocaisPdf(
  locais: LocalVotacao[],
  filters?: { cpa?: string; uop?: string; statusFilter?: string; search?: string }
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const cpaFilter = filters?.cpa || 'TODOS';
  const uopFilter = filters?.uop || 'TODAS';

  // 1. Filtragem estrita e precisa
  let filtered = locais;
  if (cpaFilter !== 'TODOS') {
    filtered = filtered.filter((l) => normalizeCpaName(l.cpa) === cpaFilter);
  }
  if (uopFilter !== 'TODAS') {
    filtered = filtered.filter((l) => (l.uop || '').trim() === uopFilter);
  }
  if (filters?.statusFilter === 'IMPLANTADAS') filtered = filtered.filter((l) => isSim(l.implantada));
  if (filters?.statusFilter === 'NAO_IMPLANTADAS') filtered = filtered.filter((l) => !isSim(l.implantada));
  if (filters?.statusFilter === 'DESMOBILIZADAS') filtered = filtered.filter((l) => isSim(l.desmobilizada));
  if (filters?.statusFilter === 'NAO_DESMOBILIZADAS') filtered = filtered.filter((l) => !isSim(l.desmobilizada));
  if (filters?.statusFilter === 'SENSIVEIS') filtered = filtered.filter((l) => isSim(l.areaSensivel));
  if (filters?.statusFilter === 'DOMINGO') filtered = filtered.filter((l) => isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo));
  if (filters?.statusFilter === 'BLINDADO') filtered = filtered.filter((l) => isSim(l.blindado) || isSim(l.utilizacaoBlindado));
  if (filters?.statusFilter === 'DUPLICIDADES') filtered = filtered.filter((l) => l.isDuplicado);

  const isObsVal = (l: LocalVotacao) => {
    const obs = (l.observacoes || l.observacao || '').trim();
    if (!obs) return false;
    const lower = obs.toLowerCase();
    return (
      obs !== '-' &&
      lower !== 'sem alteração' &&
      lower !== 'sem alteracao' &&
      lower !== 'ok' &&
      lower !== 'não' &&
      lower !== 'nao' &&
      lower !== 'nenhuma' &&
      lower !== 'nenhum'
    );
  };

  if (filters?.statusFilter === 'ALTERACOES') filtered = filtered.filter(isObsVal);

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter((l) => {
      const nome = (l.nomeLocal || l.local || '').toLowerCase();
      const endereco = (l.endereco || '').toLowerCase();
      const bairro = (l.bairro || '').toLowerCase();
      const uop = (l.uop || '').toLowerCase();
      const cpa = (l.cpa || '').toLowerCase();
      const zona = String(l.numZona || l.zonaEleitoral || '');
      const obs = (l.observacoes || l.observacao || '').toLowerCase();
      return (
        nome.includes(q) ||
        endereco.includes(q) ||
        bairro.includes(q) ||
        uop.includes(q) ||
        cpa.includes(q) ||
        zona.includes(q) ||
        obs.includes(q)
      );
    });
  }

  const isAlteracoesFilter = filters?.statusFilter === 'ALTERACOES';
  const isDuplicidadesFilter = filters?.statusFilter === 'DUPLICIDADES';
  const total = filtered.length;
  const sensiveis = filtered.filter((l) => isSim(l.areaSensivel)).length;
  const blindado = filtered.filter((l) => isSim(l.blindado) || isSim(l.utilizacaoBlindado)).length;
  const impDomingo = filtered.filter((l) => isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo)).length;
  const totalAptos = filtered.reduce((acc, l) => acc + (Number(l.qtdAptos || l.totalEleitoresAptos) || 0), 0);
  const implantadas = filtered.filter((l) => isSim(l.implantada)).length;
  const desmobilizadas = filtered.filter((l) => isSim(l.desmobilizada)).length;

  const pctImp = total > 0 ? ((implantadas / total) * 100).toFixed(1) : '0.0';
  const pctDesmob = total > 0 ? ((desmobilizadas / total) * 100).toFixed(1) : '0.0';

  // =========================================================================
  // CARD DE QUANTITATIVO E ELEITORADO (Apenas o card solicitado)
  // Conforme solicitação do operador: sem caixas secundárias nem efetivo
  // =========================================================================
  const cardY = 25;
  const cardHeight = 17;

  // Box 1: Quantitativo e Eleitorado
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(14, cardY, 90, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('LOCAIS DE VOTAÇÃO & ELEITORES', 18, cardY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Locais de Votação: ${total.toLocaleString('pt-BR')}`, 18, cardY + 10.5);
  doc.text(`Eleitores Aptos: ${totalAptos.toLocaleString('pt-BR')}`, 18, cardY + 15);

  // =========================================================================
  // TABELA 1: SÍNTESE POR UNIDADE (UOP)
  // =========================================================================
  const uopGroups: Record<
    string,
    {
      cpa: string;
      total: number;
      sensiveis: number;
      blindado: number;
      aptos: number;
      imp: number;
      desmob: number;
    }
  > = {};

  filtered.forEach((l) => {
    const key = (l.uop || 'N/I').trim();
    if (!uopGroups[key]) {
      uopGroups[key] = {
        cpa: normalizeCpaName(l.cpa),
        total: 0,
        sensiveis: 0,
        blindado: 0,
        aptos: 0,
        imp: 0,
        desmob: 0,
      };
    }
    const g = uopGroups[key];
    g.total++;
    if (isSim(l.areaSensivel)) g.sensiveis++;
    if (isSim(l.blindado) || isSim(l.utilizacaoBlindado)) g.blindado++;
    g.aptos += Number(l.qtdAptos || l.totalEleitoresAptos) || 0;
    if (isSim(l.implantada)) g.imp++;
    if (isSim(l.desmobilizada)) g.desmob++;
  });

  const uopSummaryRows = Object.keys(uopGroups)
    .sort()
    .map((uop) => {
      const g = uopGroups[uop];
      return [
        g.cpa,
        uop,
        g.total.toString(),
        g.sensiveis.toString(),
        g.blindado.toString(),
        g.aptos.toLocaleString('pt-BR'),
        `${g.imp} (${g.total > 0 ? ((g.imp / g.total) * 100).toFixed(0) : 0}%)`,
        `${g.desmob} (${g.total > 0 ? ((g.desmob / g.total) * 100).toFixed(0) : 0}%)`,
      ];
    });

  autoTable(doc, {
    startY: 45,
    head: [
      [
        'CPA',
        'Unidade (UOP)',
        'Locais',
        'Área Sensível',
        'Blindado',
        'Eleitores Aptos',
        'Urna Implantada',
        'Desmobilização',
      ],
    ],
    body: uopSummaryRows,
    margin: { top: 25, bottom: 15, left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      3: { halign: 'center', textColor: [185, 28, 28], fontStyle: 'bold', cellWidth: 26 }, // rose-700
      4: { halign: 'center', textColor: [67, 56, 202], fontStyle: 'bold', cellWidth: 24 }, // indigo-700
      5: { halign: 'right', cellWidth: 32 },
      6: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 32 }, // emerald-700
      7: { halign: 'center', textColor: [29, 78, 216], fontStyle: 'bold', cellWidth: 32 }, // blue-700
    },
  });

  // =========================================================================
  // TABELA 2: LISTAGEM COMPLETA DOS LOCAIS DE VOTAÇÃO
  // Toda a base filtrada (sem colunas de efetivo conforme solicitado)
  // =========================================================================
  const detailRows = filtered.map((l) => {
    if (isDuplicidadesFilter) {
      return [
        l.numZona || l.zonaEleitoral || '',
        l.linhaPlanilha ? `L.${l.linhaPlanilha}` : '-',
        normalizeCpaName(l.cpa),
        l.uop || '',
        (l.nomeLocal || l.local || '').slice(0, 36),
        (l.endereco || '').slice(0, 34),
        isSim(l.areaSensivel) ? 'SIM' : 'NÃO',
        isSim(l.blindado) || isSim(l.utilizacaoBlindado) ? 'SIM' : 'NÃO',
        (l.duplicidadeMotivo || 'Duplicidade detectada').slice(0, 65),
      ];
    }

    const row = [
      l.numZona || l.zonaEleitoral || '',
      normalizeCpaName(l.cpa),
      l.uop || '',
      (l.nomeLocal || l.local || '').slice(0, isAlteracoesFilter ? 40 : 48),
      (l.bairro || '').slice(0, isAlteracoesFilter ? 20 : 24),
      isSim(l.areaSensivel) ? 'SIM' : 'NÃO',
      isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo) ? 'SIM' : 'NÃO',
      isSim(l.blindado) || isSim(l.utilizacaoBlindado) ? 'SIM' : 'NÃO',
      (l.qtdAptos || l.totalEleitoresAptos || 0).toLocaleString('pt-BR'),
      isSim(l.implantada) ? 'SIM' : 'NÃO',
      isSim(l.desmobilizada) ? 'SIM' : 'NÃO',
    ];

    if (isAlteracoesFilter) {
      row.push(l.observacoes || l.observacao || '-');
    }
    return row;
  });

  // Sempre iniciar a tabela detalhada em nova página para organização limpa
  doc.addPage();

  autoTable(doc, {
    startY: 26,
    head: [
      isDuplicidadesFilter
        ? [
            'Zona',
            'Linha',
            'CPA',
            'UOP',
            'Local de Votação',
            'Endereço',
            'Sensível',
            'Blindado',
            'Identificação da Duplicidade / Conflito Territorial',
          ]
        : isAlteracoesFilter
        ? [
            'Zona',
            'CPA',
            'UOP',
            'Local de Votação',
            'Bairro',
            'Sensível',
            'Domingo',
            'Blindado',
            'Aptos',
            'Implant.',
            'Desmob.',
            'Observações e Alterações Registradas',
          ]
        : [
            'Zona',
            'CPA',
            'UOP',
            'Local de Votação',
            'Bairro',
            'Sensível',
            'Domingo',
            'Blindado',
            'Aptos',
            'Implantada',
            'Desmobiliz.',
          ],
    ],
    body: detailRows,
    margin: { top: 25, bottom: 15, left: 14, right: 14 },
    theme: 'striped',
    headStyles: {
      fillColor: [51, 65, 85], // slate-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.2,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: isAlteracoesFilter
      ? {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
          3: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
          4: { halign: 'left', cellWidth: 26 },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'center', cellWidth: 14 },
          7: { halign: 'center', cellWidth: 14 },
          8: { halign: 'right', cellWidth: 16 },
          9: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 16 },
          10: { halign: 'center', textColor: [29, 78, 216], fontStyle: 'bold', cellWidth: 16 },
          11: { halign: 'left', fontStyle: 'bold', textColor: [180, 83, 9] },
        }
      : {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
          3: { halign: 'left', cellWidth: 74 },
          4: { halign: 'left', cellWidth: 38 },
          5: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 18 },
          7: { halign: 'center', cellWidth: 18 },
          8: { halign: 'right', cellWidth: 24 },
          9: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 22 },
          10: { halign: 'center', textColor: [29, 78, 216], fontStyle: 'bold', cellWidth: 22 },
        },
  });

  applyReportHeaderAndFooter(
    doc,
    isAlteracoesFilter
      ? 'RELATÓRIO — ALTERAÇÕES E OBSERVAÇÕES DOS LOCAIS DE VOTAÇÃO'
      : 'RELATÓRIO — PLANILHA GERAL DASH',
    `Filtro: ${cpaFilter} • ${uopFilter} • ${isAlteracoesFilter ? `Locais com Alterações: ${total}` : `Total: ${total.toLocaleString('pt-BR')} Locais`}`
  );

  const filePrefix = isAlteracoesFilter ? 'RELATORIO_ALTERACOES_LOCAIS' : 'RELATORIO_LOCAIS_VOTACAO';
  doc.save(`${filePrefix}_${cpaFilter.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

/**
 * Exporta o Relatório de Ocorrências
 */
function countPoliciaisInText(text: string | undefined): number {
  if (!text) return 0;
  const s = text.trim().toLowerCase();
  if (
    !s ||
    s.includes('sem alteração') ||
    s.includes('sem alteracao') ||
    s === 'não houve' ||
    s === 'nao houve' ||
    s === 'nenhuma' ||
    s === 'nenhum' ||
    s === 'ok' ||
    s === '-'
  ) {
    return 0;
  }
  const items = text
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
  return items.length > 0 ? items.length : 1;
}

/**
 * Verifica se um registro pertence ao dia especificado ('03OUT' ou '04OUT')
 * SEMPRE FOCANDO NA DATA DO CARIMBO DO FORMULÁRIO (CARIMBO DE DATA E HORA).
 */
export function matchesCarimboDate(
  carimbo: string | undefined,
  targetDay: '03OUT' | '04OUT',
  fallbackText?: string
): boolean {
  if (!carimbo && !fallbackText) return false;
  const c = (carimbo || '').trim().toLowerCase();
  const fb = (fallbackText || '').trim().toLowerCase();

  if (targetDay === '03OUT') {
    // Carimbo contendo 03/10, 3/10, 03out, 03-10 ou 3-10
    if (
      c.includes('03/10') ||
      c.includes('3/10') ||
      c.includes('03out') ||
      c.includes('03-10') ||
      c.includes('3-10')
    ) {
      return true;
    }
    // Fallback caso o carimbo venha com formato diferente ou de pré-teste (ex: 23/09)
    if (fb && !c.includes('/10')) {
      if (
        fb.includes('03out') ||
        fb.includes('03/10') ||
        fb.includes('3/10') ||
        fb.includes('sábado') ||
        fb.includes('sabado') ||
        fb.includes('03 de out')
      ) {
        return true;
      }
    }
    return false;
  }

  if (targetDay === '04OUT') {
    // Carimbo contendo 04/10, 4/10, 04out, 04-10 ou 4-10
    if (
      c.includes('04/10') ||
      c.includes('4/10') ||
      c.includes('04out') ||
      c.includes('04-10') ||
      c.includes('4-10')
    ) {
      return true;
    }
    // Fallback caso o carimbo venha com formato diferente ou de pré-teste
    if (fb && !c.includes('/10')) {
      if (
        fb.includes('04out') ||
        fb.includes('04/10') ||
        fb.includes('4/10') ||
        fb.includes('domingo') ||
        fb.includes('04 de out')
      ) {
        // Se for serviço iniciado no dia 03 (ex: "Serviço do dia 03OUT26"), prioriza 03OUT
        if (fb.includes('serviço do dia 03') || fb.includes('servico do dia 03') || fb.includes('03out26 ( 14:00')) {
          return false;
        }
        return true;
      }
    }
    return false;
  }

  return true;
}

function isNaoHouve(val: string | undefined): boolean {
  if (!val) return true;
  const s = val.trim().toLowerCase();
  return (
    s === 'não houve' ||
    s === 'nao houve' ||
    s === 'sem alteração' ||
    s === 'sem alteracao' ||
    s === 'nenhuma' ||
    s === 'nenhum' ||
    s === '-' ||
    s === 'ok' ||
    s === ''
  );
}

export interface OcorrenciasPdfOptions {
  dia?: 'TODOS' | '03OUT' | '04OUT' | string;
  cpa?: string;
  opm?: string;
  crimeFilter?: string;
  search?: string;
}

/**
 * Exporta o Relatório de Ocorrências com suporte a filtragem por CPA, OPM e Carimbo de Data/Hora (03OUT ou 04OUT)
 */
export function exportOcorrenciasPdf(
  ocorrencias: Ocorrencia[],
  diaOrOptions: 'TODOS' | '03OUT' | '04OUT' | string | OcorrenciasPdfOptions = 'TODOS',
  extraOptions?: OcorrenciasPdfOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  let options: OcorrenciasPdfOptions = {};
  if (typeof diaOrOptions === 'string') {
    options = { dia: diaOrOptions, ...extraOptions };
  } else if (typeof diaOrOptions === 'object' && diaOrOptions !== null) {
    options = { ...diaOrOptions };
  }

  const diaFilter = options.dia || 'TODOS';
  const cpaFilter = options.cpa || 'TODOS';
  const opmFilter = options.opm || 'TODAS';
  const crimeFilter = options.crimeFilter || 'TODOS';
  const searchFilter = (options.search || '').trim().toLowerCase();

  // 1. Filtragem por CPA
  let filtered = ocorrencias;
  if (cpaFilter !== 'TODOS') {
    filtered = filtered.filter((o) => {
      const cpaVal = normalizeCpaName(o.comandoIntermediario || o.cpa || '');
      return cpaVal === cpaFilter;
    });
  }

  // 2. Filtragem por OPM
  if (opmFilter !== 'TODAS') {
    filtered = filtered.filter((o) => {
      const opmVal = (o.opm || o.uop || '').trim();
      return opmVal === opmFilter;
    });
  }

  // 3. Filtragem por Dia com foco no Carimbo de Data e Hora
  if (diaFilter === '03OUT' || diaFilter === '04OUT') {
    filtered = filtered.filter((o) =>
      matchesCarimboDate(o.carimbo, diaFilter, `${o.servicoDia || ''} ${o.dataHoraFato || ''} ${o.dinamica || ''}`)
    );
  }

  // 4. Filtragem por categoria de crime se selecionada
  if (crimeFilter !== 'TODOS') {
    filtered = filtered.filter((oc) => {
      if (crimeFilter === 'Crimes comuns contra candidatos') return !isNaoHouve(oc.crimesCandidatos);
      if (crimeFilter === 'Crimes comuns nos locais de votação/apuração') return !isNaoHouve(oc.crimesLocaisVotacao);
      if (crimeFilter === 'Crimes Eleitorais') return !isNaoHouve(oc.crimesEleitorais);
      if (crimeFilter === 'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação') {
        return !isNaoHouve(oc.incidentesSeguranca);
      }
      if (crimeFilter === 'Prisões/apreensões no entorno e/ou locais de votação') return !isNaoHouve(oc.prisoesApreensoes);
      return true;
    });
  }

  // 5. Busca textual ampla
  if (searchFilter) {
    filtered = filtered.filter((oc) => {
      const cpaVal = normalizeCpaName(oc.comandoIntermediario || oc.cpa || '').toLowerCase();
      const opmVal = (oc.opm || oc.uop || '').toLowerCase();
      const carimbo = (oc.carimbo || '').toLowerCase();
      const servico = (oc.servicoDia || '').toLowerCase();
      const local = (oc.local || oc.bairro || oc.localidade || '').toLowerCase();
      const hora = (oc.hora || '').toLowerCase();
      const bopm = (oc.bopm || '').toLowerCase();
      const ro = (oc.ro || '').toLowerCase();
      const dinamica = (oc.dinamica || oc.historico || '').toLowerCase();
      const informante = `${oc.posto || ''} ${oc.nomeGuerra || ''} ${oc.rg || ''}`.toLowerCase();
      const crimesStr = (oc.crimesRegistrados || []).join(' ').toLowerCase();

      return (
        carimbo.includes(searchFilter) ||
        servico.includes(searchFilter) ||
        cpaVal.includes(searchFilter) ||
        opmVal.includes(searchFilter) ||
        local.includes(searchFilter) ||
        hora.includes(searchFilter) ||
        bopm.includes(searchFilter) ||
        ro.includes(searchFilter) ||
        dinamica.includes(searchFilter) ||
        informante.includes(searchFilter) ||
        crimesStr.includes(searchFilter)
      );
    });
  }

  const total = filtered.length;

  const diaLabel =
    diaFilter === '03OUT'
      ? 'DIA 03OUT26 (SÁBADO)'
      : diaFilter === '04OUT'
      ? 'DIA 04OUT26 (DOMINGO)'
      : 'GERAL (TODOS OS DIAS)';

  // Detalhamento dos filtros para o subtítulo do relatório
  const filterParts: string[] = [];
  if (cpaFilter !== 'TODOS') filterParts.push(`Comando: ${cpaFilter}`);
  if (opmFilter !== 'TODAS') filterParts.push(`OPM: ${opmFilter}`);
  filterParts.push(`Período: ${diaLabel}`);
  const filtroSubtitle = filterParts.join(' • ');

  // Nome do arquivo de saída
  const fileParts = ['RELATORIO_OCORRENCIAS'];
  if (cpaFilter !== 'TODOS') fileParts.push(cpaFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (opmFilter !== 'TODAS') fileParts.push(opmFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (diaFilter === '03OUT') fileParts.push('03OUT26');
  else if (diaFilter === '04OUT') fileParts.push('04OUT26');
  else fileParts.push('GERAL');
  const filename = `${fileParts.filter(Boolean).join('_').replace(/__+/g, '_')}.pdf`;

  const rows = filtered.length > 0 ? filtered.map((o) => {
    // Lista todos os crimes assinalados nas 5 perguntas da planilha
    let crimesText = 'Não houve';
    if (o.crimesRegistrados && o.crimesRegistrados.length > 0) {
      crimesText = o.crimesRegistrados.map((c) => `• ${c}`).join('\n');
    } else if (o.seHouverOcorrenciaDizerQual && o.seHouverOcorrenciaDizerQual !== 'Não houve') {
      crimesText = `• ${o.seHouverOcorrenciaDizerQual}`;
    }

    return [
      o.carimbo || '-',
      normalizeCpaName(o.comandoIntermediario || o.cpa || ''),
      o.opm || o.uop || '-',
      crimesText,
      o.local || o.bairro || o.localidade || '-',
      o.hora || '-',
      o.bopm || 'Não informado',
      o.ro || 'Não informado',
      o.dinamica || o.historico || '-',
    ];
  }) : [
    [
      '-',
      cpaFilter !== 'TODOS' ? cpaFilter : '-',
      opmFilter !== 'TODAS' ? opmFilter : '-',
      'Nenhum fato ou ocorrência registrado para os filtros selecionados.',
      '-',
      '-',
      '-',
      '-',
      'Sem alterações registradas no período/unidade selecionada.',
    ]
  ];

  autoTable(doc, {
    startY: 23,
    head: [
      [
        'Carimbo Data/Hora',
        'Comando Intermediário',
        'OPM',
        'Crimes Registrados no Pleito (Planilha)',
        'Local',
        'Hora',
        'BOPM',
        'RO',
        'Dinâmica',
      ],
    ],
    body: rows,
    margin: { top: 23, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      4: { halign: 'left', cellWidth: 32 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'left' },
    },
  });

  applyReportHeaderAndFooter(
    doc,
    `RELATÓRIO DE OCORRÊNCIAS — ${filtroSubtitle}`,
    `Total de Registros: ${total} • Filtros: ${filtroSubtitle}`,
    'ACOMPANHAMENTO DE INCIDENTES E CRIMES NO PLEITO ELEITORAL'
  );

  doc.save(filename);
}

export interface FaltasPdfOptions {
  dia?: 'TODOS' | '03OUT' | '04OUT' | string;
  cpa?: string;
  opm?: string;
  search?: string;
}

/**
 * Exporta o Relatório de Faltas de Efetivo com suporte a filtragem por CPA, OPM e Carimbo de Data/Hora (03OUT ou 04OUT)
 * Inclui totalização por linha enviada e identificação clara dos policiais faltosos
 */
export function exportFaltasPdf(
  faltas: FaltaEfetivo[],
  diaOrOptions: 'TODOS' | '03OUT' | '04OUT' | string | FaltasPdfOptions = 'TODOS',
  extraOptions?: FaltasPdfOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  let options: FaltasPdfOptions = {};
  if (typeof diaOrOptions === 'string') {
    options = { dia: diaOrOptions, ...extraOptions };
  } else if (typeof diaOrOptions === 'object' && diaOrOptions !== null) {
    options = { ...diaOrOptions };
  }

  const diaFilter = options.dia || 'TODOS';
  const cpaFilter = options.cpa || 'TODOS';
  const opmFilter = options.opm || 'TODAS';
  const searchFilter = (options.search || '').trim().toLowerCase();

  // 1. Filtragem por CPA
  let filtered = faltas;
  if (cpaFilter !== 'TODOS') {
    filtered = filtered.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      return cpaVal === cpaFilter;
    });
  }

  // 2. Filtragem por OPM
  if (opmFilter !== 'TODAS') {
    filtered = filtered.filter((f) => {
      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      return opmVal === opmFilter;
    });
  }

  // 3. Filtragem por Dia com foco no Carimbo de Data e Hora
  if (diaFilter === '03OUT' || diaFilter === '04OUT') {
    filtered = filtered.filter((f) =>
      matchesCarimboDate(f.carimbo, diaFilter, `${f.servicoDia || ''} ${f.turno || ''}`)
    );
  }

  // 4. Busca textual ampla
  if (searchFilter) {
    filtered = filtered.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '').toLowerCase();
      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').toLowerCase();
      const carimbo = (f.carimbo || '').toLowerCase();
      const servico = (f.servicoDia || f.turno || '').toLowerCase();
      const posto = (f.posto || f.postoGrad || '').toLowerCase();
      const rg = (f.rg || '').toLowerCase();
      const nome = (f.nomeGuerra || '').toLowerCase();
      const faltasTexto = (f.faltasPoe || f.motivo || '').toLowerCase();

      return (
        carimbo.includes(searchFilter) ||
        servico.includes(searchFilter) ||
        posto.includes(searchFilter) ||
        rg.includes(searchFilter) ||
        nome.includes(searchFilter) ||
        cpaVal.includes(searchFilter) ||
        opmVal.includes(searchFilter) ||
        faltasTexto.includes(searchFilter)
      );
    });
  }

  const total = filtered.length;

  const diaLabel =
    diaFilter === '03OUT'
      ? 'DIA 03OUT26 (SÁBADO)'
      : diaFilter === '04OUT'
      ? 'DIA 04OUT26 (DOMINGO)'
      : 'GERAL (TODOS OS DIAS)';

  // Detalhamento dos filtros para o subtítulo do relatório
  const filterParts: string[] = [];
  if (cpaFilter !== 'TODOS') filterParts.push(`Comando: ${cpaFilter}`);
  if (opmFilter !== 'TODAS') filterParts.push(`OPM: ${opmFilter}`);
  filterParts.push(`Período: ${diaLabel}`);
  const filtroSubtitle = filterParts.join(' • ');

  // Nome do arquivo de saída
  const fileParts = ['RELATORIO_FALTAS'];
  if (cpaFilter !== 'TODOS') fileParts.push(cpaFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (opmFilter !== 'TODAS') fileParts.push(opmFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (diaFilter === '03OUT') fileParts.push('03OUT26');
  else if (diaFilter === '04OUT') fileParts.push('04OUT26');
  else fileParts.push('GERAL');
  const filename = `${fileParts.filter(Boolean).join('_').replace(/__+/g, '_')}.pdf`;

  // Totalização geral de policiais faltosos do conjunto filtrado
  let totalPoliciaisFaltosos = 0;
  filtered.forEach((f) => {
    totalPoliciaisFaltosos += countPoliciaisInText(f.faltasPoe || f.motivo);
  });

  // Card de Totalização Geral no topo (Y=20 a 30.5) - Sem sobrepor cabeçalho nem tabela
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, 20.5, 277, 10, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`TOTALIZAÇÃO DO EFETIVO [${filtroSubtitle}]:`, 14, 27);

  doc.setFont('helvetica', 'normal');
  doc.text(`Envios: ${total}`, 130, 27);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`Total Policiais Faltosos: ${totalPoliciaisFaltosos}`, 175, 27);

  // Linhas da tabela - Contendo a quantidade de faltas de cada linha enviada
  const rows = filtered.length > 0 ? filtered.map((f) => {
    const qtdFaltasLinha = countPoliciaisInText(f.faltasPoe || f.motivo);

    return [
      f.carimbo || f.data || '-',
      f.servicoDia || f.turno || '-',
      f.posto || f.postoGrad || '-',
      f.rg || '-',
      f.nomeGuerra || '-',
      normalizeCpaName(f.comandoIntermediario || f.cpa || ''),
      f.opm || f.uopDestino || '-',
      `${qtdFaltasLinha} falta(s)`,
      f.faltasPoe || f.motivo || 'sem alteração',
    ];
  }) : [
    [
      '-',
      '-',
      '-',
      '-',
      '-',
      cpaFilter !== 'TODOS' ? cpaFilter : '-',
      opmFilter !== 'TODAS' ? opmFilter : '-',
      '0 falta(s)',
      'Nenhum registro de falta de efetivo para os filtros selecionados.',
    ]
  ];

  autoTable(doc, {
    startY: 33,
    head: [
      [
        'Carimbo Data/Hora',
        'Serviço do Dia',
        'Posto',
        'RG',
        'Nome de Guerra',
        'Comando',
        'OPM',
        'Total Faltas (Linha)',
        'Faltas no POE - Identificação do Policial Faltoso',
      ],
    ],
    body: rows,
    margin: { top: 33, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.2,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'left', cellWidth: 32 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'left', fontStyle: 'bold', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], cellWidth: 24 },
      8: { halign: 'left' },
    },
  });

  applyReportHeaderAndFooter(
    doc,
    `RELATÓRIO DE FALTAS DE EFETIVO — ${filtroSubtitle}`,
    `Envios: ${total} • Policiais Faltosos: ${totalPoliciaisFaltosos} • Filtros: ${filtroSubtitle}`,
    'CONTROLE E REGISTRO OPERACIONAL DE EFETIVO NO POE'
  );

  doc.save(filename);
}

export const exportImplantacaoDesmobilizacaoPdf = exportLocaisPdf;

