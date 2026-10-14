import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaltaEfetivo } from '../types';
import { normalizeCpaName } from './sheetService';
import { countPoliciaisInText } from '../components/FaltasTab';
import { matchesCarimboDate } from './pdfService';

export interface VerificacaoPdfOptions {
  cpa?: string;
  opm?: string;
  dia?: string;
  search?: string;
}

/**
 * Aplica cabeçalho limpo e rodapé nas páginas do relatório sem sobreposição
 */
function applyVerificacaoHeaderAndFooter(
  doc: jsPDF,
  title: string,
  subtitle?: string
) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // CABEÇALHO OFICIAL EMG-PM/3
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(
      'OPERAÇÃO ELEIÇÕES 2026 — SEÇÃO DE PLANEJAMENTO OPERACIONAL (EMG-PM/3)',
      pageWidth / 2,
      7,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      'RELATÓRIO DE FALTAS DE EFETIVO (BASE DEPURADA - SEM DUPLICIDADES) • TOTALIZAÇÃO POR CPA E OPM',
      pageWidth / 2,
      10.5,
      { align: 'center' }
    );

    // Linha divisória
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(10, 12, pageWidth - 10, 12);

    // RODAPÉ DISCRETO 'Dev.Fiel.26'
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(10, pageHeight - 8.5, pageWidth - 10, pageHeight - 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Dev.Fiel.26', 10, pageHeight - 5.5);

    const pageStr = `Página ${i} de ${pageCount}`;
    doc.text(pageStr, pageWidth - 10, pageHeight - 5.5, { align: 'right' });
  }
}

/**
 * Exporta o Relatório Personalizado de Faltas Depuradas em PDF
 * - Card de Totalização Geral no topo
 * - 1. Quadro Resumo de Faltas por CPA com totais
 * - 2. Quadro Resumo de Faltas por OPM com totais
 * - 3. Relação Analítica Completa por OPM e CPA com quantidade de faltas por linha
 */
export function exportVerificacaoPdf(
  faltas: FaltaEfetivo[],
  options?: VerificacaoPdfOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cpaFilter = options?.cpa || 'TODOS';
  const opmFilter = options?.opm || 'TODAS';
  const diaFilter = options?.dia || 'TODOS';
  const searchFilter = (options?.search || '').toLowerCase().trim();

  // 1. Filtragem da base
  let filtered = faltas;

  if (cpaFilter !== 'TODOS') {
    filtered = filtered.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      return cpaVal === cpaFilter;
    });
  }

  if (opmFilter !== 'TODAS') {
    filtered = filtered.filter((f) => {
      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      return opmVal.toLowerCase().includes(opmFilter.toLowerCase());
    });
  }

  // Filtragem de Dia (2º Turno Oficial: 24OUT e 25OUT; descarta 03 e 04 de outubro)
  filtered = filtered.filter((f) =>
    matchesCarimboDate(f.carimbo, diaFilter || 'TODOS', `${f.servicoDia || ''} ${f.turno || ''}`)
  );

  if (searchFilter) {
    filtered = filtered.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '').toLowerCase();
      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').toLowerCase();
      const carimbo = (f.carimbo || '').toLowerCase();
      const email = (f.email || '').toLowerCase();
      const posto = (f.posto || f.postoGrad || '').toLowerCase();
      const rg = (f.rg || '').toLowerCase();
      const nome = (f.nomeGuerra || '').toLowerCase();
      const faltasTexto = (f.faltasPoe || f.motivo || '').toLowerCase();

      return (
        carimbo.includes(searchFilter) ||
        email.includes(searchFilter) ||
        posto.includes(searchFilter) ||
        rg.includes(searchFilter) ||
        nome.includes(searchFilter) ||
        cpaVal.includes(searchFilter) ||
        opmVal.includes(searchFilter) ||
        faltasTexto.includes(searchFilter)
      );
    });
  }

  // Ordenação por OPM e carimbo
  filtered = [...filtered].sort((a, b) => {
    const opmA = (a.opm || a.uopDestino || a.opmOrigem || '').trim();
    const opmB = (b.opm || b.uopDestino || b.opmOrigem || '').trim();
    const cmp = opmA.localeCompare(opmB, 'pt-BR', { numeric: true });
    if (cmp !== 0) return cmp;
    return (a.carimbo || '').localeCompare(b.carimbo || '');
  });

  const totalEnvios = filtered.length;
  let totalFaltas = 0;
  filtered.forEach((f) => {
    totalFaltas += countPoliciaisInText(f.faltasPoe || f.motivo);
  });

  // Estatísticas por CPA
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

  const cpaMap: Record<
    string,
    {
      cpa: string;
      totalFaltas: number;
      totalEnvios: number;
      opms: Set<string>;
    }
  > = {};

  const baseCpas = cpaFilter !== 'TODOS' ? [cpaFilter] : standardComandos;
  baseCpas.forEach((cmd) => {
    cpaMap[cmd] = {
      cpa: cmd,
      totalFaltas: 0,
      totalEnvios: 0,
      opms: new Set(),
    };
  });

  // Estatísticas por OPM
  const opmMap: Record<
    string,
    {
      opm: string;
      cpa: string;
      totalFaltas: number;
      totalEnvios: number;
    }
  > = {};

  filtered.forEach((f) => {
    const cpaName = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
    const opmName = (f.opm || f.uopDestino || f.opmOrigem || 'Não informada').trim();
    const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);

    if (cpaName) {
      if (!cpaMap[cpaName]) {
        cpaMap[cpaName] = {
          cpa: cpaName,
          totalFaltas: 0,
          totalEnvios: 0,
          opms: new Set(),
        };
      }
      cpaMap[cpaName].totalEnvios += 1;
      cpaMap[cpaName].totalFaltas += qtd;
      if (opmName) cpaMap[cpaName].opms.add(opmName);
    }

    if (opmName) {
      if (!opmMap[opmName]) {
        opmMap[opmName] = {
          opm: opmName,
          cpa: cpaName,
          totalFaltas: 0,
          totalEnvios: 0,
        };
      }
      opmMap[opmName].totalEnvios += 1;
      opmMap[opmName].totalFaltas += qtd;
      if (cpaName && (!opmMap[opmName].cpa || opmMap[opmName].cpa === '1º CPA')) {
        opmMap[opmName].cpa = cpaName;
      }
    }
  });

  const sortedCpas = Object.values(cpaMap)
    .filter((c) => (cpaFilter !== 'TODOS' ? true : c.totalEnvios > 0 || c.totalFaltas > 0))
    .sort((a, b) => {
      const idxA = standardComandos.indexOf(a.cpa);
      const idxB = standardComandos.indexOf(b.cpa);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.cpa.localeCompare(b.cpa);
    });

  const sortedOpms = Object.values(opmMap).sort((a, b) => {
    if (b.totalFaltas !== a.totalFaltas) {
      return b.totalFaltas - a.totalFaltas;
    }
    return a.opm.localeCompare(b.opm, 'pt-BR', { numeric: true });
  });

  // Título e Filtros
  let currentY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RELATÓRIO OFICIAL DE FALTAS DE EFETIVO (BASE DEPURADA)', 10, currentY);

  const filterDesc = [
    cpaFilter !== 'TODOS' ? `Comando: ${cpaFilter}` : 'Todos os Comandos',
    opmFilter !== 'TODAS' ? `OPM: ${opmFilter}` : 'Todas as OPMs',
    diaFilter !== 'TODOS' ? `Dia: ${diaFilter}` : 'Geral (Todos os Dias)',
    `Total Faltas: ${totalFaltas}`,
  ].join(' • ');

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(filterDesc, 10, currentY);

  currentY += 4;

  // CARD DE TOTALIZAÇÃO GERAL DESTACADO
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, currentY, 277, 9.5, 1.5, 1.5, 'FD');

  doc.setFontSize(8.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('TOTALIZAÇÃO CONSOLIDADA DO ESTADO (BASE DEPURADA SEM DUPLICIDADES):', 14, currentY + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`TOTAL GERAL DE FALTAS: ${totalFaltas}`, 210, currentY + 6);

  currentY += 13.5;

  // =========================================================================
  // 1. QUADRO RESUMO DE FALTAS POR COMANDO INTERMEDIÁRIO (CPA)
  // Colunas: Comando Intermediário | Quantidade de Faltas | OPMs com Registro de Faltas
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. QUADRO RESUMO DE FALTAS POR COMANDO INTERMEDIÁRIO (CPA)', 10, currentY);

  currentY += 2;

  const cpaTableRows = sortedCpas.map((c) => {
    return [
      c.cpa,
      c.totalFaltas > 0 ? `${c.totalFaltas} falta(s)` : '0',
      Array.from(c.opms).join(', ') || 'Nenhuma',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'COMANDO INTERMEDIÁRIO (CPA)',
        'QUANTIDADE DE FALTAS',
        'OPMS COM REGISTRO DE FALTAS',
      ],
    ],
    body: cpaTableRows.length > 0 ? cpaTableRows : [['Nenhum comando com dados', '0', '-']],
    foot: [
      [
        'TOTAL GERAL',
        `${totalFaltas} falta(s)`,
        `${sortedOpms.length} OPM(s) registradas`,
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 50, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] },
      2: { cellWidth: 172 },
    },
    margin: { top: 16, bottom: 12, left: 10, right: 10 },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 7;

  // =========================================================================
  // 2. QUADRO RESUMO DE FALTAS POR OPM (BATALHÕES E UNIDADES)
  // Colunas: OPM / Unidade Policial | Comando (CPA) | Quantidade de Faltas
  // =========================================================================
  if (currentY + 35 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('2. QUADRO RESUMO DE FALTAS POR OPM (BATALHÕES E UNIDADES)', 10, currentY);

  currentY += 2;

  const opmTableRows = sortedOpms.map((o) => {
    return [
      o.opm,
      o.cpa,
      o.totalFaltas > 0 ? `${o.totalFaltas} falta(s)` : '0',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'OPM / UNIDADE POLICIAL',
        'COMANDO (CPA)',
        'QUANTIDADE DE FALTAS',
      ],
    ],
    body: opmTableRows.length > 0 ? opmTableRows : [['Nenhuma OPM registrada', '-', '0']],
    foot: [
      [
        'TOTAL GERAL',
        `${sortedCpas.length} Comando(s)`,
        `${totalFaltas} falta(s)`,
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold' },
      1: { cellWidth: 77, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 80, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] },
    },
    margin: { top: 16, bottom: 12, left: 10, right: 10 },
  });

  // =========================================================================
  // 3. RELAÇÃO ANALÍTICA DETALHADA DOS ENVIOS (PÁGINA NOVA)
  // =========================================================================
  doc.addPage();
  currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. RELAÇÃO ANALÍTICA DETALHADA DOS ENVIOS DE FALTAS NO POE', 10, currentY);

  currentY += 2;

  const analiticaRows = filtered.map((f, idx) => {
    const cpa = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
    const opm = (f.opm || f.uopDestino || f.opmOrigem || 'OPM').trim();
    const posto = f.posto || f.postoGrad || '';
    const nome = f.nomeGuerra || '';
    const rg = f.rg ? `(RG ${f.rg.replace(/[^0-9]/g, '')})` : '';
    const oficial = `${posto} ${nome} ${rg}`.trim() || 'Oficial';
    const email = f.email || 'Não informado';
    const faltasTexto = (f.faltasPoe || f.motivo || 'Sem alteração').trim();
    const qtd = countPoliciaisInText(faltasTexto);

    return [
      String(idx + 1),
      `${opm}\n(${cpa})`,
      f.carimbo || '-',
      email,
      oficial,
      faltasTexto,
      qtd > 0 ? `${qtd} falta(s)` : '0',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '#',
        'OPM / COMANDO',
        'DATA / HORA ENVIO',
        'ENDEREÇO DE E-MAIL',
        'OFICIAL QUE ENVIOU',
        'FALTAS NO POE - IDENTIFICAÇÃO DO POLICIAL FALTOSO',
        'QTD FALTAS',
      ],
    ],
    body: analiticaRows.length > 0 ? analiticaRows : [['-', '-', '-', '-', '-', 'Nenhum registro', '0']],
    foot: [
      [
        'TOTAL',
        `${sortedOpms.length} OPM(s)`,
        '-',
        '-',
        '-',
        'TOTAL GERAL DE POLICIAIS FALTOSOS',
        `${totalFaltas} falta(s)`,
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 6.2,
      cellPadding: 1.6,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
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
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold', textColor: [15, 23, 42] },
      2: { cellWidth: 23, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 36 },
      4: { cellWidth: 38, fontStyle: 'bold' },
      5: { cellWidth: 122 }, // Espaço amplo para o texto completo
      6: { cellWidth: 25, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] },
    },
    margin: { top: 16, bottom: 12, left: 10, right: 10 },
  });

  applyVerificacaoHeaderAndFooter(
    doc,
    'RELATÓRIO OFICIAL DE FALTAS DE EFETIVO (BASE DEPURADA)',
    filterDesc
  );

  const cleanDate = new Date().toISOString().slice(0, 10);
  const fileName = `RELATORIO_FALTAS_DEPURADAS_${cpaFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${cleanDate}.pdf`;
  doc.save(fileName);
}
