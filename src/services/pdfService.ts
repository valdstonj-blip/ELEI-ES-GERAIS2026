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
  if (upper.includes('COE')) return 'COE';
  if (upper.includes('CPE')) return 'CPE';
  const match = upper.match(/([1-8])/);
  if (match) return `${match[1]}º CPA`;
  return raw.trim();
}

/**
 * Aplica cabeçalho e rodapé limpos, técnicos e corporativos da Seção de Planejamento EMG-PM/3
 * NÃO inclui 'Governo do Estado' nem 'Polícia Militar'.
 * Usa apenas 'OPERAÇÃO ELEIÇÕES 2026 — SEÇÃO DE PLANEJAMENTO OPERACIONAL' e 'RELATÓRIO • ELEIÇÕES 2026'.
 */
function applyReportHeaderAndFooter(
  doc: jsPDF,
  title: string,
  subtitle?: string,
  subsystemLabel: string = 'SISTEMA DE GESTÃO E ACOMPANHAMENTO OPERACIONAL'
) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // ==========================================
    // CABEÇALHO LIMPO E DISCRETO
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('OPERAÇÃO ELEIÇÕES 2026 — SEÇÃO DE PLANEJAMENTO OPERACIONAL', pageWidth / 2, 7.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subsystemLabel, pageWidth / 2, 11.5, { align: 'center' });

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(title.toUpperCase(), 10, 16);
    }

    if (subtitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(subtitle, pageWidth - 10, 16, { align: 'right' });
    }

    // Linha divisória sutil perfeitamente separada
    doc.setDrawColor(203, 213, 225); // slate-300
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

export interface LocaisPdfOptions {
  cpa?: string;
  uop?: string;
  statusFilter?: string;
  search?: string;
  reportType?: 'COMPLETO' | 'SINTETICO' | 'DETALHADO';
}

/**
 * Exporta o Relatório de Locais de Votação
 * Responde diretamente às perguntas solicitadas pelo operador:
 * 1. Locais de Votação
 * 2. CPA selecionado (ou todos)
 * 3. Áreas Sensíveis
 * 4. Implantação da Urna no Domingo
 * 5. Utilização do Blindado para Implantação da Urna (Sim/Não)
 * 6. Eleitores Aptos
 * 7. Status do Evento: Urna Implantada no Local (Sim/Não) e Desmobilização (Sim/Não)
 */
export function exportLocaisPdf(
  locais: LocalVotacao[],
  filters?: LocaisPdfOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const cpaFilter = filters?.cpa || 'TODOS';
  const uopFilter = filters?.uop || 'TODAS';
  const reportType = filters?.reportType || 'COMPLETO';

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
  if (filters?.statusFilter === 'ALT_2TURNO') filtered = filtered.filter((l) => Boolean(l.hasAlteracoes2Turno));
  if (filters?.statusFilter === 'ENERGIA_CABOS') filtered = filtered.filter((l) => Boolean(l.hasAlteracaoEnergia));

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
      const alt2 = (l.alteracoes2Turno || '').toLowerCase();
      return (
        nome.includes(q) ||
        endereco.includes(q) ||
        bairro.includes(q) ||
        uop.includes(q) ||
        cpa.includes(q) ||
        zona.includes(q) ||
        obs.includes(q) ||
        alt2.includes(q)
      );
    });
  }

  const isAlteracoesFilter = filters?.statusFilter === 'ALTERACOES';
  const isAlt2TurnoFilter = filters?.statusFilter === 'ALT_2TURNO';
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
  // PAINEL DE INDICADORES EXECUTIVOS (5 CARDS DE METAS - LARGURA TOTAL 277MM)
  // =========================================================================
  const cardY = 22;
  const cardHeight = 17.5;
  const cardW = 53;
  const gap = 3;

  // Card 1: Locais & Eleitores
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(10, cardY, cardW, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text('LOCAIS DE VOTAÇÃO', 13, cardY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(total.toLocaleString('pt-BR'), 13, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Eleitores: ${totalAptos.toLocaleString('pt-BR')}`, 13, cardY + 14.8);

  // Card 2: Áreas Sensíveis
  const c2X = 10 + cardW + gap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(253, 164, 175); // rose-300
  doc.roundedRect(c2X, cardY, cardW, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('ÁREAS SENSÍVEIS (RISCO)', c2X + 3, cardY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text(sensiveis.toLocaleString('pt-BR'), c2X + 3, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`${total > 0 ? ((sensiveis / total) * 100).toFixed(1) : '0.0'}% dos locais`, c2X + 3, cardY + 14.8);

  // Card 3: Apoio Blindado & Domingo
  const c3X = c2X + cardW + gap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(199, 210, 254); // indigo-300
  doc.roundedRect(c3X, cardY, cardW, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text('APOIO OPERACIONAL', c3X + 3, cardY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 27, 75); // indigo-950
  doc.text(`Blindado: ${blindado.toLocaleString('pt-BR')}`, c3X + 3, cardY + 10.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Urna Domingo: ${impDomingo.toLocaleString('pt-BR')} locais`, c3X + 3, cardY + 14.8);

  // Card 4: Urnas Implantadas
  const c4X = c3X + cardW + gap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(167, 243, 208); // emerald-300
  doc.roundedRect(c4X, cardY, cardW, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text('URNAS IMPLANTADAS', c4X + 3, cardY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text(`${implantadas.toLocaleString('pt-BR')} (${pctImp}%)`, c4X + 3, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(5, 150, 105);
  doc.text(`Meta total: ${total.toLocaleString('pt-BR')} locais`, c4X + 3, cardY + 14.8);

  // Card 5: Desmobilização
  const c5X = c4X + cardW + gap;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(191, 219, 254); // blue-300
  doc.roundedRect(c5X, cardY, cardW, cardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('DESMOBILIZAÇÃO DE URNAS', c5X + 3, cardY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216);
  doc.text(`${desmobilizadas.toLocaleString('pt-BR')} (${pctDesmob}%)`, c5X + 3, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(37, 99, 235);
  doc.text('Concluídas no período', c5X + 3, cardY + 14.8);

  // =========================================================================
  // TABELA 1: SÍNTESE CONSOLIDADA POR UNIDADE (UOP)
  // Gerada nos modos COMPLETO e SINTETICO
  // =========================================================================
  const uopGroups: Record<
    string,
    {
      cpa: string;
      total: number;
      sensiveis: number;
      blindado: number;
      domingo: number;
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
        domingo: 0,
        aptos: 0,
        imp: 0,
        desmob: 0,
      };
    }
    const g = uopGroups[key];
    g.total++;
    if (isSim(l.areaSensivel)) g.sensiveis++;
    if (isSim(l.blindado) || isSim(l.utilizacaoBlindado)) g.blindado++;
    if (isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo)) g.domingo++;
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
        g.sensiveis > 0 ? `${g.sensiveis} (${((g.sensiveis / g.total) * 100).toFixed(0)}%)` : '0',
        g.blindado.toString(),
        g.domingo.toString(),
        g.aptos.toLocaleString('pt-BR'),
        `${g.imp} (${g.total > 0 ? ((g.imp / g.total) * 100).toFixed(0) : 0}%)`,
        `${g.desmob} (${g.total > 0 ? ((g.desmob / g.total) * 100).toFixed(0) : 0}%)`,
      ];
    });

  const uopSummaryFoot = [
    [
      'TOTAL',
      `${Object.keys(uopGroups).length} UOPs`,
      total.toLocaleString('pt-BR'),
      sensiveis > 0 ? `${sensiveis} (${total > 0 ? ((sensiveis / total) * 100).toFixed(0) : 0}%)` : '0',
      blindado.toLocaleString('pt-BR'),
      impDomingo.toLocaleString('pt-BR'),
      totalAptos.toLocaleString('pt-BR'),
      `${implantadas} (${pctImp}%)`,
      `${desmobilizadas} (${pctDesmob}%)`,
    ],
  ];

  let nextTableStartY = 43;

  if (reportType !== 'DETALHADO') {
    autoTable(doc, {
      startY: 43,
      head: [
        [
          'CPA',
          'Unidade (UOP)',
          'Total Locais',
          'Área Sensível',
          'Apoio Blindado',
          'Urna Domingo',
          'Eleitores Aptos',
          'Urnas Implantadas',
          'Desmobilização',
        ],
      ],
      body: uopSummaryRows,
      foot: uopSummaryFoot,
      margin: { top: 24, bottom: 12, left: 10, right: 10 },
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      footStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 24 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
        3: { halign: 'center', textColor: [185, 28, 28], fontStyle: 'bold', cellWidth: 28 }, // rose-700
        4: { halign: 'center', textColor: [67, 56, 202], fontStyle: 'bold', cellWidth: 26 }, // indigo-700
        5: { halign: 'center', textColor: [180, 83, 9], fontStyle: 'bold', cellWidth: 26 },  // amber-700
        6: { halign: 'right', cellWidth: 34 },
        7: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 34 }, // emerald-700
        8: { halign: 'center', textColor: [29, 78, 216], fontStyle: 'bold', cellWidth: 34 }, // blue-700
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 43;
    if (finalY < 135 && uopSummaryRows.length <= 4) {
      nextTableStartY = finalY + 8;
    } else {
      nextTableStartY = -1; // força nova página
    }
  }

  // Determina se deve renderizar a Tabela 2 (Listagem Detalhada):
  // Se for o Estado inteiro sem filtros específicos (5.000+ locais) e não for explicitamente DETALHADO,
  // a Tabela 1 (Quadro Síntese por Batalhão) é o relatório executivo oficial (rápido, limpo e legível).
  // Se houver qualquer filtro (CPA, UOP, Status ou busca) OU se reportType === 'DETALHADO', renderiza a Tabela 2.
  const isGlobalGeneral =
    cpaFilter === 'TODOS' &&
    uopFilter === 'TODAS' &&
    (!filters?.statusFilter || filters.statusFilter === 'TODOS') &&
    !filters?.search;

  const shouldRenderDetails =
    reportType === 'DETALHADO' || (!isGlobalGeneral && reportType !== 'SINTETICO');

  if (shouldRenderDetails) {
    const detailRows = filtered.map((l) => {
      const enderecoCompleto = [l.endereco, l.bairro].filter(Boolean).join(' - ') || '-';

      if (isAlt2TurnoFilter) {
        return [
          l.numZona || l.zonaEleitoral || '-',
          l.linhaPlanilha ? `L.${l.linhaPlanilha}` : '-',
          normalizeCpaName(l.cpa),
          l.uop || '-',
          l.nomeLocal || l.local || '-',
          enderecoCompleto,
          isSim(l.areaSensivel) ? 'SIM' : 'NÃO',
          isSim(l.implantada) ? 'SIM' : 'NÃO',
          l.alteracoes2Turno || 'Sem alterações registradas no 2º Turno',
        ];
      }

      if (isAlteracoesFilter) {
        return [
          l.numZona || l.zonaEleitoral || '-',
          normalizeCpaName(l.cpa),
          l.uop || '-',
          l.nomeLocal || l.local || '-',
          enderecoCompleto,
          isSim(l.areaSensivel) ? 'SIM' : 'NÃO',
          (Number(l.qtdAptos || l.totalEleitoresAptos) || 0).toLocaleString('pt-BR'),
          isSim(l.implantada) ? 'SIM' : 'NÃO',
          l.observacoes || l.observacao || 'Sem alterações registradas',
        ];
      }

      return [
        l.numZona || l.zonaEleitoral || '-',
        normalizeCpaName(l.cpa),
        l.uop || '-',
        l.nomeLocal || l.local || '-',
        enderecoCompleto,
        isSim(l.areaSensivel) ? 'SIM' : 'NÃO',
        isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo) ? 'SIM' : 'NÃO',
        isSim(l.blindado) || isSim(l.utilizacaoBlindado) ? 'SIM' : 'NÃO',
        (Number(l.qtdAptos || l.totalEleitoresAptos) || 0).toLocaleString('pt-BR'),
        isSim(l.implantada) ? 'SIM' : 'NÃO',
        isSim(l.desmobilizada) ? 'SIM' : 'NÃO',
      ];
    });

    if (nextTableStartY === -1 || reportType === 'DETALHADO') {
      if (reportType !== 'DETALHADO') {
        doc.addPage();
      }
      nextTableStartY = reportType === 'DETALHADO' ? 43 : 24;
    }

    autoTable(doc, {
      startY: nextTableStartY,
      head: [
        isAlt2TurnoFilter
          ? [
              'Zona',
              'Linha',
              'CPA',
              'UOP',
              'Local de Votação',
              'Endereço / Bairro',
              'Sensível',
              'Implant.',
              'Alterações na Votação 2º Turno (Coluna O)',
            ]
          : isAlteracoesFilter
          ? [
              'Zona',
              'CPA',
              'UOP',
              'Local de Votação',
              'Endereço / Bairro',
              'Sensível',
              'Aptos',
              'Implant.',
              'Observações e Alterações Registradas',
            ]
          : [
              'Zona',
              'CPA',
              'UOP',
              'Local de Votação',
              'Endereço / Bairro',
              'Sensível',
              'Domingo',
              'Blindado',
              'Aptos',
              'Implantada',
              'Desmobiliz.',
            ],
      ],
      body: detailRows,
      margin: { top: 24, bottom: 12, left: 10, right: 10 },
      theme: 'striped',
      headStyles: {
        fillColor: [51, 65, 85], // slate-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      styles: {
        fontSize: 6.5,
        cellPadding: 1.3,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: isAlt2TurnoFilter
        ? {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
            1: { halign: 'center', cellWidth: 15 },
            2: { halign: 'center', cellWidth: 18 },
            3: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
            4: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
            5: { halign: 'left', cellWidth: 48 },
            6: { halign: 'center', cellWidth: 16 },
            7: { halign: 'center', cellWidth: 16 },
            8: { halign: 'left', fontStyle: 'bold', textColor: [29, 78, 216], cellWidth: 76 },
          }
        : isAlteracoesFilter
        ? {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
            1: { halign: 'center', cellWidth: 18 },
            2: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
            3: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
            4: { halign: 'left', cellWidth: 44 },
            5: { halign: 'center', cellWidth: 15 },
            6: { halign: 'right', cellWidth: 18 },
            7: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 17 },
            8: { halign: 'left', fontStyle: 'bold', textColor: [180, 83, 9], cellWidth: 82 },
          }
        : {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
            1: { halign: 'center', cellWidth: 18 },
            2: { halign: 'left', fontStyle: 'bold', cellWidth: 22 },
            3: { halign: 'left', cellWidth: 64 },
            4: { halign: 'left', cellWidth: 55 },
            5: { halign: 'center', cellWidth: 17 },
            6: { halign: 'center', cellWidth: 17 },
            7: { halign: 'center', cellWidth: 17 },
            8: { halign: 'right', cellWidth: 19 },
            9: { halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold', cellWidth: 18 },
            10: { halign: 'center', textColor: [29, 78, 216], fontStyle: 'bold', cellWidth: 18 },
          },
    });
  }

  // Título e escopo institucionais sem menções inadequadas
  let reportTitle = 'RELATÓRIO OPERACIONAL — LOCAIS DE VOTAÇÃO';
  let filePrefix = 'RELATORIO_LOCAIS_VOTACAO';

  if (filters?.statusFilter === 'ALT_2TURNO') {
    reportTitle = 'RELATÓRIO DE ALTERAÇÕES NA VOTAÇÃO 2º TURNO';
    filePrefix = 'RELATORIO_ALT_2TURNO_LOCAIS';
  } else if (filters?.statusFilter === 'ALTERACOES') {
    reportTitle = 'RELATÓRIO DE ALTERAÇÕES E OBSERVAÇÕES — LOCAIS DE VOTAÇÃO';
    filePrefix = 'RELATORIO_ALTERACOES_LOCAIS';
  } else if (filters?.statusFilter === 'SENSIVEIS') {
    reportTitle = 'RELATÓRIO OPERACIONAL — LOCAIS EM ÁREAS SENSÍVEIS';
    filePrefix = 'RELATORIO_LOCAIS_SENSIVEIS';
  } else if (filters?.statusFilter === 'IMPLANTADAS') {
    reportTitle = 'RELATÓRIO OPERACIONAL — URNAS IMPLANTADAS';
    filePrefix = 'RELATORIO_URNAS_IMPLANTADAS';
  } else if (filters?.statusFilter === 'NAO_IMPLANTADAS') {
    reportTitle = 'RELATÓRIO OPERACIONAL — URNAS PENDENTES DE IMPLANTAÇÃO';
    filePrefix = 'RELATORIO_URNAS_PENDENTES';
  } else if (filters?.statusFilter === 'DESMOBILIZADAS') {
    reportTitle = 'RELATÓRIO OPERACIONAL — URNAS DESMOBILIZADAS';
    filePrefix = 'RELATORIO_URNAS_DESMOBILIZADAS';
  } else if (filters?.statusFilter === 'NAO_DESMOBILIZADAS') {
    reportTitle = 'RELATÓRIO OPERACIONAL — URNAS PENDENTES DE DESMOBILIZAÇÃO';
    filePrefix = 'RELATORIO_URNAS_PENDENTES_DESMOB';
  } else if (filters?.statusFilter === 'DOMINGO') {
    reportTitle = 'RELATÓRIO OPERACIONAL — URNAS COM IMPLANTAÇÃO NO DOMINGO';
    filePrefix = 'RELATORIO_URNAS_DOMINGO';
  } else if (filters?.statusFilter === 'BLINDADO') {
    reportTitle = 'RELATÓRIO OPERACIONAL — LOCAIS COM APOIO DE BLINDADO';
    filePrefix = 'RELATORIO_LOCAIS_BLINDADO';
  }

  if (isGlobalGeneral && reportType !== 'DETALHADO') {
    reportTitle += ' (QUADRO CONSOLIDADO)';
    filePrefix += '_CONSOLIDADO';
  } else if (reportType === 'SINTETICO') {
    reportTitle += ' (QUADRO SINTÉTICO)';
    filePrefix += '_SINTETICO';
  } else if (reportType === 'DETALHADO') {
    reportTitle += ' (LISTAGEM DETALHADA)';
    filePrefix += '_DETALHADO';
  }

  const scopeParts: string[] = [];
  if (cpaFilter !== 'TODOS') {
    scopeParts.push(`Comando: ${cpaFilter}`);
  } else {
    scopeParts.push('Âmbito: Todos os CPAs');
  }
  if (uopFilter !== 'TODAS') {
    scopeParts.push(`Unidade: ${uopFilter}`);
  }
  scopeParts.push(`Total: ${total.toLocaleString('pt-BR')} Locais`);
  const subtitle = scopeParts.join(' • ');

  applyReportHeaderAndFooter(
    doc,
    reportTitle,
    subtitle,
    'SISTEMA DE GESTÃO E ACOMPANHAMENTO OPERACIONAL'
  );

  const fileParts = [filePrefix];
  if (cpaFilter !== 'TODOS') fileParts.push(cpaFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (uopFilter !== 'TODAS') fileParts.push(uopFilter.replace(/[^A-Za-z0-9]/g, '_'));
  if (filters?.statusFilter && filters.statusFilter !== 'TODOS') {
    fileParts.push(filters.statusFilter);
  }
  const filename = `${fileParts.filter(Boolean).join('_').replace(/__+/g, '_')}.pdf`;

  doc.save(filename);
}

/**
 * Exporta o Relatório de Ocorrências
 */
function isSemAlteracaoFalta(text: string | undefined | null): boolean {
  if (!text) return true;
  const s = String(text).trim();
  if (!s || s === '-' || s === '.' || s === '/' || s === '0' || s === '00') return true;

  const norm = s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!norm || norm === '0' || norm === 'OK') return true;

  const termosSemFalta = [
    'SEM ALTERACAO',
    'SEM ALTERACOES',
    'SEM ALTERAC',
    'SEM FALTA',
    'SEM FALTAS',
    'NAO HOUVE',
    'NAO HA',
    'NENHUMA',
    'NENHUM',
    'NADA CONSTA',
    'NADA A RELATAR',
    'ZERO',
    'NORMAL',
    'TUDO NORMAL',
    'TUDO OK',
    'NO MOMENTO SEM ALTERACAO',
    'NO MOMENTO SEM ALTERACOES',
  ];

  for (const t of termosSemFalta) {
    if (norm === t || norm.includes(t)) {
      return true;
    }
  }

  return false;
}

function isStructuralHeader(line: string): boolean {
  const upper = line.toUpperCase().trim();
  if (!upper) return true;
  if (/^[0-9]+[ªº°]\s*CIA/i.test(upper) || /^CIA\b/i.test(upper) || /^SEDE\b/i.test(upper)) return true;
  if (/^(I|II|III|IV|V|\d+)\s*[-–—]\s*(FALTAS?|ATRASOS?|DISPENSAS?)/i.test(upper)) return true;
  if (/^(S\/|SEM\s+)ALTERAÇ/i.test(upper) || /^NÃO\s+HOUVE/i.test(upper) || upper === '-' || upper === 'NADA CONSTA') return true;
  return false;
}

function countPoliciaisInText(text: string | undefined): number {
  if (!text) return 0;
  if (isSemAlteracaoFalta(text)) return 0;

  const items = text
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !isStructuralHeader(item) && !isSemAlteracaoFalta(item));

  if (items.length === 0) return 0;

  const validMilitaryLines = items.filter(
    (l) =>
      /(SARGENTO|SGT|CABO|CB\b|SOLDADO|SD\b|SUBTEN|SUB\s*TEN|TENENTE|TEN\b|CAPITÃO|CAP\b|MAJOR|MAJ\b|ST\b)/i.test(l) ||
      /(?:RG\s*[:\-\s]*\s*|\b)[0-9]{2,3}\.[0-9]{3}|[0-9]{4,7}/i.test(l)
  );

  if (validMilitaryLines.length > 0) {
    return validMilitaryLines.length;
  }

  return items.length;
}

/**
 * Verifica se um registro pertence ao dia especificado ('24OUT', '25OUT' ou 'TODOS')
 * No 2º Turno Oficial, 'TODOS' corresponde exclusivamente aos dias 24 e 25 de Outubro.
 * Registros de 03 e 04 de Outubro (1º Turno) são estritamente excluídos.
 * SEMPRE FOCANDO NA DATA DO CARIMBO DO FORMULÁRIO (CARIMBO DE DATA E HORA) E SERVIÇO DO DIA.
 */
export function matchesCarimboDate(
  carimbo: string | undefined,
  targetDay: '24OUT' | '25OUT' | 'TODOS' | string,
  fallbackText?: string
): boolean {
  // Quando o filtro for 'TODOS': exibe todos os registros da base oficial ativa do 2º Turno
  if (targetDay === 'TODOS') {
    return true;
  }

  if (!carimbo && !fallbackText) return false;
  const c = (carimbo || '').trim().toLowerCase();
  const fb = (fallbackText || '').trim().toLowerCase();

  // Testes para 24 de Outubro (Sábado - 2º Turno Oficial)
  const is24Out =
    c.includes('24/10') ||
    c.includes('24out') ||
    c.includes('24-10') ||
    c.includes('24 de out') ||
    fb.includes('24out') ||
    fb.includes('24/10') ||
    fb.includes('24 de out') ||
    fb.includes('sábado') ||
    fb.includes('sabado') ||
    // Se o carimbo for anterior a 25/10 e não indicar domingo, enquadra no 1º dia do 2º Turno
    (!c.includes('25/10') && !fb.includes('25out') && !fb.includes('domingo'));

  // Testes para 25 de Outubro (Domingo - 2º Turno Oficial)
  const is25Out =
    c.includes('25/10') ||
    c.includes('25out') ||
    c.includes('25-10') ||
    c.includes('25 de out') ||
    fb.includes('25out') ||
    fb.includes('25/10') ||
    fb.includes('25 de out') ||
    fb.includes('domingo');

  if (targetDay === '24OUT') {
    return is24Out;
  }

  if (targetDay === '25OUT') {
    return is25Out;
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

  // 3. Filtragem por Dia com foco no Carimbo de Data e Hora (2º Turno Oficial: 24OUT e 25OUT)
  filtered = filtered.filter((o) =>
    matchesCarimboDate(o.carimbo, diaFilter || 'TODOS', `${o.servicoDia || ''} ${o.dataHoraFato || ''} ${o.dinamica || ''}`)
  );

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
    diaFilter === '24OUT'
      ? 'DIA 24OUT26 (SÁBADO - 2º TURNO)'
      : diaFilter === '25OUT'
      ? 'DIA 25OUT26 (DOMINGO - 2º TURNO)'
      : diaFilter === '03OUT'
      ? 'DIA 03OUT26 (1º TURNO)'
      : diaFilter === '04OUT'
      ? 'DIA 04OUT26 (1º TURNO)'
      : '2º TURNO (24 E 25 DE OUTUBRO DE 2026)';

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
  if (diaFilter === '24OUT') fileParts.push('24OUT26');
  else if (diaFilter === '25OUT') fileParts.push('25OUT26');
  else if (diaFilter === '03OUT') fileParts.push('03OUT26');
  else if (diaFilter === '04OUT') fileParts.push('04OUT26');
  else fileParts.push('2º_TURNO_24_25_OUT');
  const filename = `${fileParts.filter(Boolean).join('_').replace(/__+/g, '_')}.pdf`;

  // 1. Totalização Executiva dos Crimes Assinalados e Ocorrências com Dinâmica
  interface CrimeStatItem {
    categoria: string;
    crime: string;
    count: number;
  }

  const crimeCountsMap = new Map<string, CrimeStatItem>();
  let countSemCrimeComDinamica = 0;

  filtered.forEach((o) => {
    let teveCrimeCategorizado = false;

    // 1. Crimes comuns contra candidatos
    if (o.crimesCandidatos && !isNaoHouve(o.crimesCandidatos)) {
      teveCrimeCategorizado = true;
      const key = `Crimes comuns contra candidatos:::${o.crimesCandidatos.trim()}`;
      const item = crimeCountsMap.get(key) || {
        categoria: 'Crimes comuns contra candidatos',
        crime: o.crimesCandidatos.trim(),
        count: 0,
      };
      item.count += 1;
      crimeCountsMap.set(key, item);
    }

    // 2. Crimes comuns nos locais de votação/apuração
    if (o.crimesLocaisVotacao && !isNaoHouve(o.crimesLocaisVotacao)) {
      teveCrimeCategorizado = true;
      const key = `Crimes comuns nos locais de votação/apuração:::${o.crimesLocaisVotacao.trim()}`;
      const item = crimeCountsMap.get(key) || {
        categoria: 'Crimes comuns nos locais de votação/apuração',
        crime: o.crimesLocaisVotacao.trim(),
        count: 0,
      };
      item.count += 1;
      crimeCountsMap.set(key, item);
    }

    // 3. Crimes Eleitorais
    if (o.crimesEleitorais && !isNaoHouve(o.crimesEleitorais)) {
      teveCrimeCategorizado = true;
      const key = `Crimes Eleitorais:::${o.crimesEleitorais.trim()}`;
      const item = crimeCountsMap.get(key) || {
        categoria: 'Crimes Eleitorais',
        crime: o.crimesEleitorais.trim(),
        count: 0,
      };
      item.count += 1;
      crimeCountsMap.set(key, item);
    }

    // 4. Incidentes de Segurança Pública
    if (o.incidentesSeguranca && !isNaoHouve(o.incidentesSeguranca)) {
      teveCrimeCategorizado = true;
      const key = `Ocorrências e Incidentes de Segurança Pública:::${o.incidentesSeguranca.trim()}`;
      const item = crimeCountsMap.get(key) || {
        categoria: 'Ocorrências e Incidentes de Segurança Pública',
        crime: o.incidentesSeguranca.trim(),
        count: 0,
      };
      item.count += 1;
      crimeCountsMap.set(key, item);
    }

    // 5. Prisões / Apreensões
    if (o.prisoesApreensoes && !isNaoHouve(o.prisoesApreensoes)) {
      teveCrimeCategorizado = true;
      const key = `Prisões/apreensões no entorno e/ou locais:::${o.prisoesApreensoes.trim()}`;
      const item = crimeCountsMap.get(key) || {
        categoria: 'Prisões/apreensões no entorno e/ou locais',
        crime: o.prisoesApreensoes.trim(),
        count: 0,
      };
      item.count += 1;
      crimeCountsMap.set(key, item);
    }

    // Fallback: crimesRegistrados
    if (!teveCrimeCategorizado && o.crimesRegistrados && o.crimesRegistrados.length > 0) {
      o.crimesRegistrados.forEach((c) => {
        if (!isNaoHouve(c)) {
          teveCrimeCategorizado = true;
          const key = `Crimes Registrados no Pleito:::${c.trim()}`;
          const item = crimeCountsMap.get(key) || {
            categoria: 'Crimes Registrados no Pleito',
            crime: c.trim(),
            count: 0,
          };
          item.count += 1;
          crimeCountsMap.set(key, item);
        }
      });
    }

    // Caso não tenha havido crime tipificado assinalado, verificar se enviou dinâmica
    if (!teveCrimeCategorizado) {
      const dinamicaTexto = (o.dinamica || o.historico || '').trim();
      if (dinamicaTexto && !isNaoHouve(dinamicaTexto) && dinamicaTexto.length > 3) {
        countSemCrimeComDinamica += 1;
      }
    }
  });

  const crimesQuantificados = Array.from(crimeCountsMap.values()).sort(
    (a, b) => b.count - a.count || a.categoria.localeCompare(b.categoria)
  );

  const totalCrimesCategorizados = crimesQuantificados.reduce((sum, item) => sum + item.count, 0);
  const totalFatosReportados = totalCrimesCategorizados + countSemCrimeComDinamica;

  // Definir ordem oficial das categorias
  const ORDEM_CATEGORIAS = [
    'Crimes comuns contra candidatos',
    'Crimes comuns nos locais de votação/apuração',
    'Crimes Eleitorais',
    'Ocorrências e Incidentes de Segurança Pública',
    'Prisões/apreensões no entorno e/ou locais',
    'Crimes Registrados no Pleito',
  ];

  // Agrupamento por Categoria Oficial
  const crimesPorCategoria = new Map<string, CrimeStatItem[]>();

  crimesQuantificados.forEach((item) => {
    let catKey = item.categoria;
    if (catKey.includes('Incidentes') || catKey.includes('Segurança Pública')) {
      catKey = 'Ocorrências e Incidentes de Segurança Pública';
    } else if (catKey.includes('Prisões') || catKey.includes('Apreensões')) {
      catKey = 'Prisões/apreensões no entorno e/ou locais';
    }
    const arr = crimesPorCategoria.get(catKey) || [];
    arr.push(item);
    crimesPorCategoria.set(catKey, arr);
  });

  // Ordenar as categorias segundo a ordem oficial
  const categoriasOrdenadas = Array.from(crimesPorCategoria.keys()).sort((a, b) => {
    const idxA = ORDEM_CATEGORIAS.indexOf(a);
    const idxB = ORDEM_CATEGORIAS.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Montagem das linhas da Tabela 1: Resumo Consolidado de Crimes e Fatos
  const summaryRows: any[][] = [];

  categoriasOrdenadas.forEach((categoriaNome) => {
    const listaCrimes = crimesPorCategoria.get(categoriaNome) || [];
    listaCrimes.sort((a, b) => b.count - a.count);
    const subtotal = listaCrimes.reduce((sum, c) => sum + c.count, 0);
    const subtotalPct =
      totalFatosReportados > 0
        ? ((subtotal / totalFatosReportados) * 100).toFixed(1) + '%'
        : '-';

    // 1. Linha de Título da Categoria com Subtotal (sem repetir a categoria em cada linha individual!)
    summaryRows.push([
      {
        content: `▶ ${categoriaNome.toUpperCase()}`,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.2,
        },
      },
      {
        content: `Subtotal: ${subtotal}`,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [185, 28, 28],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.2,
        },
      },
      {
        content: subtotalPct,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.2,
        },
      },
    ]);

    // 2. Linhas de cada crime sob esta categoria (apenas a tipificação indentada)
    listaCrimes.forEach((c) => {
      const pct =
        totalFatosReportados > 0
          ? ((c.count / totalFatosReportados) * 100).toFixed(1) + '%'
          : '-';
      summaryRows.push([
        `    • ${c.crime}`,
        c.count.toString(),
        pct,
      ]);
    });
  });

  // 3. Grupo de Ocorrências com Dinâmica narrada mas sem crime categorizado
  if (countSemCrimeComDinamica > 0) {
    const pct =
      totalFatosReportados > 0
        ? ((countSemCrimeComDinamica / totalFatosReportados) * 100).toFixed(1) + '%'
        : '-';

    summaryRows.push([
      {
        content: '▶ OCORRÊNCIAS SEM CRIME TIPIFICADO (APENAS DINÂMICA DO FATO)',
        styles: {
          fillColor: [254, 243, 199], // amber 100
          textColor: [146, 64, 14], // amber 800
          fontStyle: 'bold',
          fontSize: 7.2,
        },
      },
      {
        content: `Subtotal: ${countSemCrimeComDinamica}`,
        styles: {
          fillColor: [254, 243, 199],
          textColor: [146, 64, 14],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.2,
        },
      },
      {
        content: pct,
        styles: {
          fillColor: [254, 243, 199],
          textColor: [146, 64, 14],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.2,
        },
      },
    ]);

    summaryRows.push([
      '    • Registros com dinâmica/fato narrado (sem seleção de crime categorizado)',
      countSemCrimeComDinamica.toString(),
      pct,
    ]);
  }

  if (summaryRows.length === 0) {
    summaryRows.push([
      'Sem Alterações registradas para os filtros selecionados',
      '0',
      '0.0%',
    ]);
  }

  const summaryFoot = [
    [
      'TOTAL GERAL DE FATOS E OCORRÊNCIAS REGISTRADAS',
      totalFatosReportados.toString(),
      '100.0%',
    ],
  ];

  // =========================================================================
  // 1. QUADRO RESUMO DE TOTALIZAÇÃO DE CRIMES E FATOS ENVIADOS
  // =========================================================================
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('1. TOTALIZAÇÃO CONSOLIDADA DE CRIMES E FATOS REGISTRADOS NO PLEITO', 10, 21.5);

  autoTable(doc, {
    startY: 23,
    head: [
      [
        'Tipificação do Fato / Crime Registrado no Pleito (Planilha)',
        'Quantidade',
        '% do Total',
      ],
    ],
    body: summaryRows,
    foot: summaryFoot,
    margin: { top: 23, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    footStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 195 },
      1: { halign: 'center', cellWidth: 42, fontStyle: 'bold', textColor: [185, 28, 28] },
      2: { halign: 'center', cellWidth: 40 },
    },
  });

  const summaryFinalY = (doc as any).lastAutoTable?.finalY || 60;
  let analyticalStartY = summaryFinalY + 7;

  // Se a tabela analítica for ficar muito espremida na primeira página, abre página nova
  if (analyticalStartY > 160) {
    doc.addPage();
    analyticalStartY = 23;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. RELAÇÃO ANALÍTICA COMPLETA DAS TRANSMISSÕES (LINHA A LINHA DA PLANILHA)', 10, analyticalStartY - 1.8);

  const rows = filtered.length > 0 ? filtered.map((o) => {
    // Lista todos os crimes assinalados nas 5 perguntas da planilha
    let crimesText = 'Sem crime tipificado';
    if (o.crimesRegistrados && o.crimesRegistrados.length > 0) {
      crimesText = o.crimesRegistrados.map((c) => `• ${c}`).join('\n');
    } else if (o.seHouverOcorrenciaDizerQual && !isNaoHouve(o.seHouverOcorrenciaDizerQual)) {
      crimesText = `• ${o.seHouverOcorrenciaDizerQual}`;
    } else {
      const dinamicaTexto = (o.dinamica || o.historico || '').trim();
      crimesText = (dinamicaTexto && !isNaoHouve(dinamicaTexto)) ? 'Não categorizado (apenas dinâmica)' : '-';
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
    startY: analyticalStartY,
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

export interface DiaFaltasResumoItem {
  codigoDia: string;
  diaLabel: string;
  totalEnvios: number;
  totalFaltas: number;
  percentual: string;
  isMaior: boolean;
}

export function computeFaltasPorDia(faltas: FaltaEfetivo[]): {
  dias: DiaFaltasResumoItem[];
  diaMaisFaltoso: DiaFaltasResumoItem | null;
  totalFaltasGeral: number;
  totalEnviosGeral: number;
} {
  let totalFaltasGeral = 0;
  let totalEnviosGeral = faltas.length;

  const dia24: DiaFaltasResumoItem = {
    codigoDia: '24OUT',
    diaLabel: 'Dia 24/10/2026 (Sábado)',
    totalEnvios: 0,
    totalFaltas: 0,
    percentual: '0.0%',
    isMaior: false,
  };

  const dia25: DiaFaltasResumoItem = {
    codigoDia: '25OUT',
    diaLabel: 'Dia 25/10/2026 (Domingo)',
    totalEnvios: 0,
    totalFaltas: 0,
    percentual: '0.0%',
    isMaior: false,
  };

  const outrosDiasMap: Record<string, DiaFaltasResumoItem> = {};

  faltas.forEach((f) => {
    const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);
    totalFaltasGeral += qtd;

    const c = (f.carimbo || '').trim().toLowerCase();
    const s = (f.servicoDia || '').trim().toLowerCase();
    const d = (f.data || '').trim().toLowerCase();
    const full = `${c} ${s} ${d}`;

    const is25 =
      full.includes('25/10') ||
      full.includes('25out') ||
      full.includes('25-10') ||
      full.includes('domingo');

    const is24 =
      full.includes('24/10') ||
      full.includes('24out') ||
      full.includes('24-10') ||
      full.includes('sábado') ||
      full.includes('sabado');

    if (is25) {
      dia25.totalEnvios += 1;
      dia25.totalFaltas += qtd;
    } else if (is24) {
      dia24.totalEnvios += 1;
      dia24.totalFaltas += qtd;
    } else {
      // Captura erros de preenchimento ou outras datas de carimbo
      const m = c.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      const chaveOutra = m ? `Data ${m[1]} (Outros registros)` : 'Data não identificada';
      if (!outrosDiasMap[chaveOutra]) {
        outrosDiasMap[chaveOutra] = {
          codigoDia: 'OUTRA',
          diaLabel: chaveOutra,
          totalEnvios: 0,
          totalFaltas: 0,
          percentual: '0.0%',
          isMaior: false,
        };
      }
      outrosDiasMap[chaveOutra].totalEnvios += 1;
      outrosDiasMap[chaveOutra].totalFaltas += qtd;
    }
  });

  const dias = [dia24, dia25, ...Object.values(outrosDiasMap)];

  let maiorQtd = 0;
  dias.forEach((d) => {
    if (d.totalFaltas > maiorQtd) {
      maiorQtd = d.totalFaltas;
    }
    if (totalFaltasGeral > 0) {
      d.percentual = ((d.totalFaltas / totalFaltasGeral) * 100).toFixed(1) + '%';
    }
  });

  let diaMaisFaltoso: DiaFaltasResumoItem | null = null;
  if (maiorQtd > 0) {
    dias.forEach((d) => {
      if (d.totalFaltas === maiorQtd) {
        d.isMaior = true;
        if (!diaMaisFaltoso) diaMaisFaltoso = d;
      }
    });
  }

  return { dias, diaMaisFaltoso, totalFaltasGeral, totalEnviosGeral };
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

  // 3. Filtragem por Dia com foco no Carimbo de Data e Hora (2º Turno Oficial: 24OUT e 25OUT)
  filtered = filtered.filter((f) =>
    matchesCarimboDate(f.carimbo, diaFilter || 'TODOS', `${f.servicoDia || ''} ${f.turno || ''}`)
  );

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
    diaFilter === '24OUT'
      ? 'DIA 24OUT26 (SÁBADO - 2º TURNO)'
      : diaFilter === '25OUT'
      ? 'DIA 25OUT26 (DOMINGO - 2º TURNO)'
      : diaFilter === '03OUT'
      ? 'DIA 03OUT26 (1º TURNO)'
      : diaFilter === '04OUT'
      ? 'DIA 04OUT26 (1º TURNO)'
      : '2º TURNO (24 E 25 DE OUTUBRO DE 2026)';

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
  if (diaFilter === '24OUT') fileParts.push('24OUT26');
  else if (diaFilter === '25OUT') fileParts.push('25OUT26');
  else if (diaFilter === '03OUT') fileParts.push('03OUT26');
  else if (diaFilter === '04OUT') fileParts.push('04OUT26');
  else fileParts.push('2º_TURNO_24_25_OUT');
  const filename = `${fileParts.filter(Boolean).join('_').replace(/__+/g, '_')}.pdf`;

  // Totalização geral de policiais faltosos do conjunto filtrado
  let totalPoliciaisFaltosos = 0;
  filtered.forEach((f) => {
    totalPoliciaisFaltosos += countPoliciaisInText(f.faltasPoe || f.motivo);
  });

  // Cálculo de faltas por dia levando em consideração carimbo de data e hora do formulário
  const statsDias = computeFaltasPorDia(filtered);

  // Card de Totalização Geral no topo (Y=20.5 a 30.5) - Sem sobrepor cabeçalho nem tabela
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, 20.5, 277, 10, 1.5, 1.5, 'FD');

  const bannerY = 26.8;
  const cardFontSize = 7.3;
  doc.setFontSize(cardFontSize);

  let currentX = 14;

  // 1. Título e Escopo dos Filtros
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  const titleText = `TOTALIZAÇÃO DO EFETIVO [${filtroSubtitle}]: `;
  doc.text(titleText, currentX, bannerY);
  currentX += doc.getTextWidth(titleText);

  // 2. Quantidade de Envios (sem sobrepor o título)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  const enviosText = `Envios: ${total}`;
  doc.text(enviosText, currentX, bannerY);
  currentX += doc.getTextWidth(enviosText);

  // Separador 1
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const sep1 = '   •   ';
  doc.text(sep1, currentX, bannerY);
  currentX += doc.getTextWidth(sep1);

  // 3. Total de Policiais Faltosos
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  const faltososText = `Total Policiais Faltosos: ${totalPoliciaisFaltosos}`;
  doc.text(faltososText, currentX, bannerY);
  currentX += doc.getTextWidth(faltososText);

  // Separador 2
  const sep2 = '   •   ';
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(sep2, currentX, bannerY);
  currentX += doc.getTextWidth(sep2);

  // 4. Indicador de Maior Incidência / Distribuição
  if (statsDias.diaMaisFaltoso && statsDias.totalFaltasGeral > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const diaDesc =
      statsDias.diaMaisFaltoso.codigoDia === '24OUT'
        ? 'Dia 24/10 (Sáb)'
        : 'Dia 25/10 (Dom)';
    doc.text(
      `Maior Incidência: ${diaDesc} (${statsDias.diaMaisFaltoso.totalFaltas} faltas)`,
      currentX,
      bannerY
    );
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Distribuição homogênea', currentX, bannerY);
  }

  // =========================================================================
  // 1. TABELA RESUMO POR COMANDO (CPA)
  // =========================================================================
  const standardComandos = [
    '1º CPA',
    '2º CPA',
    '3º CPA',
    '4º CPA',
    '5º CPA',
    '6º CPA',
    '7º CPA',
    '8º CPA',
    'CPP',
    'COE',
    'CPE',
  ];

  const cpaStatsMap: Record<
    string,
    {
      comando: string;
      totalFaltas: number;
      totalEnvios: number;
      semAlteracao: number;
      comFaltas: number;
    }
  > = {};

  const baseCpas = cpaFilter !== 'TODOS' ? [cpaFilter] : standardComandos;
  baseCpas.forEach((cmd) => {
    cpaStatsMap[cmd] = {
      comando: cmd,
      totalFaltas: 0,
      totalEnvios: 0,
      semAlteracao: 0,
      comFaltas: 0,
    };
  });

  // Estatísticas por OPM (qual OPM e quantidade de faltas por OPM)
  const opmStatsMap: Record<
    string,
    {
      opm: string;
      comando: string;
      totalFaltas: number;
      totalEnvios: number;
    }
  > = {};

  filtered.forEach((f) => {
    const cpaName = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
    const opmName = (f.opm || f.uopDestino || f.opmOrigem || 'Não especificada').trim();
    const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);

    // Contabilização CPA
    if (cpaName) {
      if (!cpaStatsMap[cpaName]) {
        cpaStatsMap[cpaName] = {
          comando: cpaName,
          totalFaltas: 0,
          totalEnvios: 0,
          semAlteracao: 0,
          comFaltas: 0,
        };
      }
      cpaStatsMap[cpaName].totalEnvios += 1;
      cpaStatsMap[cpaName].totalFaltas += qtd;
      if (qtd > 0) {
        cpaStatsMap[cpaName].comFaltas += 1;
      } else {
        cpaStatsMap[cpaName].semAlteracao += 1;
      }
    }

    // Contabilização OPM
    if (opmName) {
      if (!opmStatsMap[opmName]) {
        opmStatsMap[opmName] = {
          opm: opmName,
          comando: cpaName,
          totalFaltas: 0,
          totalEnvios: 0,
        };
      }
      opmStatsMap[opmName].totalEnvios += 1;
      opmStatsMap[opmName].totalFaltas += qtd;
      if (cpaName && (!opmStatsMap[opmName].comando || opmStatsMap[opmName].comando === '1º CPA')) {
        opmStatsMap[opmName].comando = cpaName;
      }
    }
  });

  const sortedCpaStats = Object.values(cpaStatsMap).sort((a, b) => {
    const idxA = standardComandos.indexOf(a.comando);
    const idxB = standardComandos.indexOf(b.comando);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.comando.localeCompare(b.comando);
  });

  const cpaSummaryRows = sortedCpaStats.map((item) => [
    item.comando,
    item.totalFaltas > 0 ? `${item.totalFaltas} falta(s)` : '0',
  ]);

  let cpaFaltasTot = 0;
  let cpaEnviosTot = 0;
  sortedCpaStats.forEach((c) => {
    cpaFaltasTot += c.totalFaltas;
    cpaEnviosTot += c.totalEnvios;
  });

  const cpaSummaryFoot = [
    [
      'TOTAL GERAL',
      `${cpaFaltasTot} falta(s)`,
    ],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('1. QUADRO RESUMO DE FALTAS POR CPA', 10, 34);

  autoTable(doc, {
    startY: 36,
    head: [
      [
        'CPA',
        'QUANTIDADE DE FALTAS',
      ],
    ],
    body: cpaSummaryRows,
    foot: cpaSummaryFoot,
    margin: { top: 22, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    footStyles: {
      fillColor: [15, 23, 42],
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
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 160 },
      1: { halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], cellWidth: 117 },
    },
  });

  // =========================================================================
  // 2. TABELA RESUMO POR OPM (QUAL OPM E QUANTIDADE DE FALTAS POR OPM)
  // =========================================================================
  const sortedOpmStats = Object.values(opmStatsMap).sort((a, b) => {
    if (b.totalFaltas !== a.totalFaltas) {
      return b.totalFaltas - a.totalFaltas;
    }
    return a.opm.localeCompare(b.opm);
  });

  const opmSummaryRows = sortedOpmStats.map((item) => [
    item.opm,
    item.comando || '-',
    item.totalFaltas > 0 ? `${item.totalFaltas} falta(s)` : '0',
  ]);

  const opmTableStartY = ((doc as any).lastAutoTable?.finalY || 95) + 7;
  const pageHeight = doc.internal.pageSize.getHeight();
  let opmStartY = opmTableStartY;

  if (opmStartY + 30 > pageHeight) {
    doc.addPage();
    opmStartY = 24;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('2. QUADRO RESUMO DE FALTAS POR OPM (BATALHÕES E UNIDADES)', 10, opmStartY);

  autoTable(doc, {
    startY: opmStartY + 2,
    head: [
      [
        'OPM / UNIDADE POLICIAL',
        'COMANDO (CPA)',
        'QUANTIDADE DE FALTAS',
      ],
    ],
    body: opmSummaryRows.length > 0 ? opmSummaryRows : [['Nenhuma OPM registrada', '-', '0']],
    foot: [
      [
        'TOTAL GERAL',
        `${sortedOpmStats.length} OPM(s)`,
        `${cpaFaltasTot} falta(s)`,
      ],
    ],
    margin: { top: 22, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    footStyles: {
      fillColor: [15, 23, 42],
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
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 120 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 77 },
      2: { halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], cellWidth: 80 },
    },
  });

  // =========================================================================
  // 3. QUADRO RESUMO DE FALTAS POR DATA DO EVENTO
  // =========================================================================
  const opmTableFinalY = (doc as any).lastAutoTable?.finalY || 120;
  let diaStartY = opmTableFinalY + 7;

  if (diaStartY + 30 > pageHeight) {
    doc.addPage();
    diaStartY = 24;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('3. QUADRO RESUMO DE FALTAS POR DATA DO EVENTO', 10, diaStartY);

  const diaSummaryRows = statsDias.dias.map((d) => [
    d.diaLabel,
    `${d.totalEnvios} envio(s)`,
    d.totalFaltas > 0 ? `${d.totalFaltas} falta(s)` : '0',
    d.isMaior && d.totalFaltas > 0 ? 'MAIOR NUMERO DE FALTAS' : '-',
  ]);

  const maiorDataTexto = statsDias.diaMaisFaltoso && statsDias.totalFaltasGeral > 0
    ? `Data com mais faltas: ${statsDias.diaMaisFaltoso.diaLabel}`
    : 'Distribuicao homogenea';

  const diaSummaryFoot = [
    [
      'TOTAL GERAL',
      `${statsDias.totalEnviosGeral} envio(s)`,
      `${statsDias.totalFaltasGeral} falta(s)`,
      maiorDataTexto,
    ],
  ];

  autoTable(doc, {
    startY: diaStartY + 2,
    head: [
      [
        'DATA / DIA DO EVENTO',
        'TOTAL DE ENVIOS',
        'QUANTIDADE DE FALTAS',
        'INDICADOR',
      ],
    ],
    body: diaSummaryRows,
    foot: diaSummaryFoot,
    margin: { top: 22, bottom: 12, left: 10, right: 10 },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    footStyles: {
      fillColor: [15, 23, 42],
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
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 120 },
      1: { halign: 'center', cellWidth: 45 },
      2: { halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], cellWidth: 50 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 62 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw || '');
        if (text.includes('MAIOR NUMERO')) {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
  });

  // =========================================================================
  // 4. DETALHAMENTO ANALÍTICO COMPLETO DOS ENVIOS (LINHA A LINHA DA PLANILHA)
  // =========================================================================
  const diaTableFinalY = (doc as any).lastAutoTable?.finalY || 140;
  let detailStartY = diaTableFinalY + 7;

  if (detailStartY + 30 > pageHeight) {
    doc.addPage();
    detailStartY = 24;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(
    '4. DETALHAMENTO ANALÍTICO DOS ENVIOS E IDENTIFICAÇÃO DOS POLICIAIS FALTOSOS',
    10,
    detailStartY
  );

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
    startY: detailStartY + 2,
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
    margin: { top: 22, bottom: 12, left: 10, right: 10 },
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

