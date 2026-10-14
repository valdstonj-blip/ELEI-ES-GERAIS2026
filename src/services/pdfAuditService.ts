import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AuditReportData,
  SubmissionAuditRow,
  FaltosoTotalizacao,
} from './faltasAuditService';

export interface AuditPdfOptions {
  cpa?: string;
  opm?: string;
  apenasComErros?: boolean;
  search?: string;
}

/**
 * Aplica cabeçalho limpo e rodapé nas páginas do relatório sem qualquer sobreposição com as tabelas
 */
function applyAuditHeaderAndFooter(
  doc: jsPDF,
  title: string,
  subtitle?: string
) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // ==========================================
    // CABEÇALHO LIMPO E DISCRETO (No topo, longe das tabelas)
    // ==========================================
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
      'AUDITORIA E VERIFICAÇÃO DE ENVIOS DE EFETIVO (POE) • CLASSIFICAÇÃO POR OPM',
      pageWidth / 2,
      10.5,
      { align: 'center' }
    );

    // Linha divisória fina
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(10, 12, pageWidth - 10, 12);

    // ==========================================
    // RODAPÉ DISCRETO NO CANTO (Dev.Fiel.26)
    // ==========================================
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
 * Exporta o Relatório Oficial de Auditoria e Verificação de Envios em PDF
 * - Tabela principal classificada por OPM (numérica/alfabética)
 * - Cabeçalhos fiéis à planilha + coluna ao lado especificando o erro
 * - Cores diferenciadas por tipo de erro
 * - Quadro de Totalização direto: Policial Faltoso x Qual o Erro
 */
export function exportAuditPdf(
  auditData: AuditReportData,
  filters?: AuditPdfOptions
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const cpaFilter = filters?.cpa || 'TODOS';
  const opmFilter = filters?.opm || 'TODAS';
  const apenasComErros = Boolean(filters?.apenasComErros);
  const searchTerm = (filters?.search || '').toLowerCase().trim();

  // 1. Filtragem das linhas de submissão
  let rows: SubmissionAuditRow[] = auditData.submissionAuditRows;

  if (cpaFilter !== 'TODOS') {
    rows = rows.filter((r) => r.cpa.includes(cpaFilter));
  }
  if (opmFilter !== 'TODAS') {
    rows = rows.filter((r) => r.opm.toLowerCase().includes(opmFilter.toLowerCase()));
  }
  if (apenasComErros) {
    rows = rows.filter((r) => r.temErro);
  }
  if (searchTerm) {
    rows = rows.filter(
      (r) =>
        r.opm.toLowerCase().includes(searchTerm) ||
        r.cpa.toLowerCase().includes(searchTerm) ||
        r.oficialFormatado.toLowerCase().includes(searchTerm) ||
        r.email.toLowerCase().includes(searchTerm) ||
        r.faltasRaw.toLowerCase().includes(searchTerm) ||
        r.errosFormatados.toLowerCase().includes(searchTerm)
    );
  }

  // 2. Filtragem da totalização de faltosos
  let faltososList: FaltosoTotalizacao[] = auditData.faltososTotalizacao;
  if (cpaFilter !== 'TODOS') {
    faltososList = faltososList.filter((f) => f.cpa.includes(cpaFilter));
  }
  if (opmFilter !== 'TODAS') {
    faltososList = faltososList.filter((f) => f.opm.toLowerCase().includes(opmFilter.toLowerCase()));
  }
  if (apenasComErros) {
    faltososList = faltososList.filter((f) => f.temErro);
  }
  if (searchTerm) {
    faltososList = faltososList.filter(
      (f) =>
        f.policialFormatado.toLowerCase().includes(searchTerm) ||
        f.opm.toLowerCase().includes(searchTerm) ||
        f.rg.includes(searchTerm) ||
        f.qualErro.toLowerCase().includes(searchTerm)
    );
  }

  // Título e Subtítulo na Página 1
  let currentY = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RELATÓRIO DE AUDITORIA E VERIFICAÇÃO DE ENVIOS DE EFETIVO (POE)', 10, currentY);

  const filtroTexto = [
    cpaFilter !== 'TODOS' ? `Comando: ${cpaFilter}` : 'Todos os Comandos',
    opmFilter !== 'TODAS' ? `OPM: ${opmFilter}` : 'Todas as OPMs',
    apenasComErros ? 'Filtro: Apenas Envios com Inconsistências' : 'Filtro: Todos os Envios',
    `Total de Registros: ${rows.length}`,
  ].join(' | ');

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(filtroTexto, 10, currentY);

  currentY += 4;

  // 3. TABELA ÚNICA DE AUDITORIA POR CLASSIFICAÇÃO DE OPM
  const tableData = rows.map((r, index) => {
    return [
      String(index + 1),
      `${r.opm}\n(${r.cpa})`,
      r.carimbo,
      r.email,
      r.oficialFormatado,
      r.faltasRaw, // Texto COMPLETO e íntegro do formulário (sem cortes)
      r.errosFormatados,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '#',
        'OPM / Comando',
        'Data / Hora Envio',
        'Endereço de E-mail',
        'Oficial que Enviou',
        'Faltas Informadas no Formulário',
        'Inconsistência / Erro Identificado',
      ],
    ],
    body:
      tableData.length > 0
        ? tableData
        : [['-', '-', '-', '-', '-', '-', 'Nenhum registro encontrado para os filtros selecionados.']],
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
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
      5: { cellWidth: 85 }, // Espaço amplo para o texto completo
      6: { cellWidth: 62, fontStyle: 'bold' },
    },
    margin: { top: 16, bottom: 12, left: 10, right: 10 },
    didParseCell: (data) => {
      // Destaque de cor nas células da coluna de Inconsistência (coluna 6)
      if (data.section === 'body' && data.column.index === 6) {
        const rawRow = rows[data.row.index];
        if (rawRow) {
          if (rawRow.temErro) {
            if (rawRow.erroTipoBadge === 'OFICIAL_MULTI_OPM') {
              data.cell.styles.fillColor = [254, 243, 199]; // amber-100
              data.cell.styles.textColor = [180, 83, 9]; // amber-800
            } else if (rawRow.erroTipoBadge === 'DUPLICIDADE') {
              data.cell.styles.fillColor = [255, 228, 230]; // rose-100
              data.cell.styles.textColor = [225, 29, 72]; // rose-700
            } else if (rawRow.erroTipoBadge === 'FORMATACAO') {
              data.cell.styles.fillColor = [224, 242, 254]; // sky-100
              data.cell.styles.textColor = [3, 105, 161]; // sky-800
            } else {
              data.cell.styles.fillColor = [254, 240, 138]; // yellow-200
              data.cell.styles.textColor = [133, 77, 14]; // yellow-800
            }
          } else {
            data.cell.styles.textColor = [22, 101, 52]; // green-800 (Sem inconsistência)
          }
        }
      }
    },
  });

  // Aplica o cabeçalho oficial e rodapé 'Dev.Fiel.26' em todas as páginas sem colidir
  applyAuditHeaderAndFooter(
    doc,
    'RELATÓRIO DE AUDITORIA E VERIFICAÇÃO DE ENVIOS DE EFETIVO',
    filtroTexto
  );

  const cleanDate = new Date().toISOString().slice(0, 10);
  const fileName = `RELATORIO_AUDITORIA_POR_OPM_${cpaFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${cleanDate}.pdf`;
  doc.save(fileName);
}

export function formatTipoInconsistencia(tipo: string): string {
  switch (tipo) {
    case 'DUPLICIDADE_POLICIAL':
      return 'Duplicidade de Policial';
    case 'TRIPLICIDADE_POLICIAL':
      return 'Triplicidade de Policial';
    case 'OFICIAL_MULTI_OPM':
      return 'Oficial de outra unidade';
    case 'REENVIO_IMEDIATO':
      return 'Reenvio Quase Imediato';
    case 'LTS_DISPENSA_EM_FALTAS':
      return 'Dispensa/LTS no Campo de Falta';
    case 'FORMATACAO_ESTRUTURADA':
      return 'Formatação Estruturada Cias';
    default:
      return tipo;
  }
}
