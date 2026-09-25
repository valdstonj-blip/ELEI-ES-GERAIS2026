import React, { useState, useMemo } from 'react';
import {
  FileDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { FaltaEfetivo } from '../types';
import { exportFaltasPdf, matchesCarimboDate } from '../services/pdfService';

interface FaltasTabProps {
  faltas: FaltaEfetivo[];
  onAddFalta?: (nova: FaltaEfetivo) => void;
}

// Função utilitária precisa para contar policiais em texto com delimitadores (ex: ponto e vírgula)
export function countPoliciaisInText(text: string | undefined): number {
  if (!text) return 0;
  const lower = text.trim().toLowerCase();
  if (
    !lower ||
    lower === 'sem alteração' ||
    lower === 'sem alteracao' ||
    lower === 'não houve' ||
    lower === 'nao houve' ||
    lower === 'nenhuma' ||
    lower === 'nenhum' ||
    lower === 'ok' ||
    lower === '-'
  ) {
    return 0;
  }
  const items = text
    .split(/[;\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  return items.length > 0 ? items.length : 1;
}

export const FaltasTab: React.FC<FaltasTabProps> = ({ faltas }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCpa, setSelectedCpa] = useState('TODOS');
  const [selectedOpm, setSelectedOpm] = useState('TODAS');
  const [selectedDay, setSelectedDay] = useState<'TODOS' | '03OUT' | '04OUT'>('TODOS');
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const availableCpas = useMemo(() => {
    const set = new Set(
      faltas.map((f) => f.comandoIntermediario || f.cpa).filter(Boolean)
    );
    return ['TODOS', ...Array.from(set).sort()];
  }, [faltas]);

  const availableOpms = useMemo(() => {
    const set = new Set(
      faltas.map((f) => f.opm || f.uopDestino || f.opmOrigem).filter(Boolean)
    );
    return ['TODAS', ...Array.from(set).sort()];
  }, [faltas]);

  // Filtragem precisa em todas as colunas com foco estrito no CARIMBO DE DATA E HORA
  const filteredFaltas = useMemo(() => {
    return faltas.filter((f) => {
      const cpaVal = (f.comandoIntermediario || f.cpa || '').trim();
      if (selectedCpa !== 'TODOS' && cpaVal !== selectedCpa) return false;

      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      if (selectedOpm !== 'TODAS' && opmVal !== selectedOpm) return false;

      // Filtro de Dia focado estritamente no Carimbo de Data e Hora
      if (selectedDay !== 'TODOS') {
        if (!matchesCarimboDate(f.carimbo, selectedDay, f.servicoDia || f.turno)) {
          return false;
        }
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const carimbo = (f.carimbo || '').toLowerCase();
        const servico = (f.servicoDia || f.turno || '').toLowerCase();
        const posto = (f.posto || f.postoGrad || '').toLowerCase();
        const rg = (f.rg || '').toLowerCase();
        const nome = (f.nomeGuerra || '').toLowerCase();
        const cpa = cpaVal.toLowerCase();
        const opm = opmVal.toLowerCase();
        const faltasTexto = (f.faltasPoe || f.motivo || '').toLowerCase();

        if (
          !carimbo.includes(q) &&
          !servico.includes(q) &&
          !posto.includes(q) &&
          !rg.includes(q) &&
          !nome.includes(q) &&
          !cpa.includes(q) &&
          !opm.includes(q) &&
          !faltasTexto.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [faltas, selectedCpa, selectedOpm, searchTerm]);

  const totalPages = Math.ceil(filteredFaltas.length / itemsPerPage) || 1;
  const paginatedFaltas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFaltas.slice(start, start + itemsPerPage);
  }, [filteredFaltas, currentPage, itemsPerPage]);

  // Totalização exata da quantidade de policiais faltosos
  const stats = useMemo(() => {
    const totalEnvios = faltas.length;

    let totalPoliciaisFaltosos = 0;

    faltas.forEach((f) => {
      totalPoliciaisFaltosos += countPoliciaisInText(f.faltasPoe || f.motivo);
    });

    const opmsCount = new Set(
      faltas.map((f) => f.opm || f.uopDestino || f.opmOrigem).filter(Boolean)
    ).size;

    return { totalEnvios, totalPoliciaisFaltosos, opmsCount };
  }, [faltas]);

  // Renderizador ajustado para os textos dos policiais (separados por ponto e vírgula)
  const renderPolicialItems = (
    rawText: string | undefined,
    type: 'falta' = 'falta'
  ) => {
    const text = (rawText || '').trim();
    const lower = text.toLowerCase();

    if (
      !text ||
      lower === 'sem alteração' ||
      lower === 'sem alteracao' ||
      lower === 'não houve' ||
      lower === 'nao houve' ||
      lower === 'nenhuma' ||
      lower === 'nenhum' ||
      lower === 'ok' ||
      lower === '-'
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <CheckCircle2 className="w-3 h-3 text-slate-400" />
          <span>sem alteração</span>
        </span>
      );
    }

    const items = text
      .split(/[;\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (items.length === 0) {
      return <span className="text-slate-600 text-[11px]">{text}</span>;
    }

    return (
      <div className="space-y-1 py-0.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-1.5 p-1.5 rounded border text-[11px] font-semibold leading-tight ${
              type === 'falta'
                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                : 'bg-blue-50/80 border-blue-200 text-blue-900'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                type === 'falta' ? 'bg-rose-500' : 'bg-blue-500'
              }`}
            />
            <span className="break-words">{item}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div id="faltas-dashboard" className="space-y-3.5">
      {/* 0. Cards de Resumo com Totalização Real de Policiais Faltosos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Total de Envios
            </span>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-black text-slate-900 mt-1">
            {stats.totalEnvios}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Respostas da planilha
          </span>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-2xs flex flex-col bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">
              Total Policiais Faltosos
            </span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-2xl font-black text-rose-700 mt-1">
            {stats.totalPoliciaisFaltosos}
          </span>
          <span className="text-[10px] text-rose-600 font-semibold mt-0.5">
            {stats.totalPoliciaisFaltosos === 1 ? '1 policial faltoso' : `${stats.totalPoliciaisFaltosos} policiais faltosos`}
          </span>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-2xs flex flex-col bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
              OPMs Atendidas
            </span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-indigo-800 mt-1">
            {stats.opmsCount}
          </span>
          <span className="text-[10px] text-indigo-600 font-semibold mt-0.5">
            Batalhões e unidades registradas
          </span>
        </div>
      </div>

      {/* 1. Barra de Ferramentas Limpa (Sem botão Novo Registro) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por policial, RG, comando, OPM, serviço ou falta..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Dias: 03OUT26 e 04OUT26 pelo Carimbo de Data e Hora */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <button
              onClick={() => {
                setSelectedDay('TODOS');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                selectedDay === 'TODOS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Dias
            </button>
            <button
              onClick={() => {
                setSelectedDay('03OUT');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                selectedDay === '03OUT'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              03OUT26
            </button>
            <button
              onClick={() => {
                setSelectedDay('04OUT');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                selectedDay === '04OUT'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              04OUT26
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Comando:</span>
              <select
                value={selectedCpa}
                onChange={(e) => {
                  setSelectedCpa(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
              >
                {availableCpas.map((cpa) => (
                  <option key={cpa} value={cpa}>
                    {cpa}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500">OPM:</span>
              <select
                value={selectedOpm}
                onChange={(e) => {
                  setSelectedOpm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
              >
                {availableOpms.map((opm) => (
                  <option key={opm} value={opm}>
                    {opm}
                  </option>
                ))}
              </select>
            </div>

            {/* Menu Dropdown de Exportação em PDF com Seleção de Data */}
            <div className="relative inline-block text-left">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => exportFaltasPdf(faltas, selectedDay)}
                  title={`Baixar PDF de Faltas (${selectedDay === 'TODOS' ? 'Geral - Todos os Dias' : selectedDay})`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-l-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    {selectedDay === 'TODOS'
                      ? 'Exportar PDF Geral'
                      : `Exportar PDF (${selectedDay})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfDropdownOpen((prev) => !prev)}
                  title="Mais opções de download por data"
                  className="px-2 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-r-lg border-l border-blue-500 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {pdfDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setPdfDropdownOpen(false)}
                  />
                  <div className="origin-top-right absolute right-0 mt-1 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black/5 divide-y divide-slate-100 z-30">
                    <div className="p-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Escolha o Relatório em PDF:
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, '03OUT');
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span>PDF - Dia 03OUT26</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                          03/10
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, '04OUT');
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span>PDF - Dia 04OUT26</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                          04/10
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, 'TODOS');
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span>PDF - Completo Geral</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                          Todos
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tabela de Faltas com Cabeçalho Exato e Barras de Rolagem Horizontal e Vertical */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
          <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1260px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider shadow-xs">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[140px] bg-slate-900">
                  CARIMBO DATA HORA
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[210px] bg-slate-900">
                  SERVIÇO DO DIA
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[80px] text-center bg-slate-900">
                  POSTO
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[85px] text-center bg-slate-900">
                  RG
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px] bg-slate-900">
                  NOME DE GUERRA
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] text-center bg-slate-900">
                  COMANDO INTERMEDIÁRIO
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[100px] text-center bg-slate-900">
                  OPM
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px] text-center bg-slate-900">
                  TOTAL FALTAS (LINHA)
                </th>
                <th className="py-2.5 px-3 min-w-[400px] bg-slate-900">
                  FALTAS NO POE - IDENTIFICAÇÃO DO POLICIAL FALTOSO.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFaltas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhum registro de envio da planilha encontrado.
                  </td>
                </tr>
              ) : (
                paginatedFaltas.map((f, idx) => {
                  const carimboText = f.carimbo || f.data;
                  const servicoText = f.servicoDia || f.turno;
                  const postoText = f.posto || f.postoGrad;
                  const rgText = f.rg;
                  const nomeText = f.nomeGuerra;
                  const cpaText = f.comandoIntermediario || f.cpa || '2 CPA';
                  const opmText = f.opm || f.uopDestino || f.opmOrigem || '9º BPM';
                  const faltasTexto = f.faltasPoe || f.motivo;

                  const qtdFaltasLinha = countPoliciaisInText(faltasTexto);

                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      {/* 1. CARIMBO DATA HORA */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap align-top">
                        {carimboText}
                      </td>

                      {/* 2. SERVIÇO DO DIA */}
                      <td className="py-2.5 px-3 font-medium text-slate-900 align-top">
                        <div className="font-semibold leading-snug">{servicoText}</div>
                      </td>

                      {/* 3. POSTO */}
                      <td className="py-2.5 px-3 font-bold text-center text-slate-900 whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                          {postoText}
                        </span>
                      </td>

                      {/* 4. RG */}
                      <td className="py-2.5 px-3 font-mono text-center font-bold text-slate-700 whitespace-nowrap align-top">
                        {rgText || '-'}
                      </td>

                      {/* 5. NOME DE GUERRA */}
                      <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap align-top">
                        {nomeText || '-'}
                      </td>

                      {/* 6. COMANDO INTERMEDIÁRIO */}
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                          {cpaText}
                        </span>
                      </td>

                      {/* 7. OPM */}
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold">
                          {opmText}
                        </span>
                      </td>

                      {/* 8. TOTAL FALTAS (LINHA) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                        {qtdFaltasLinha > 0 ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{qtdFaltasLinha} Falta(s)</span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-medium">
                            0 Faltas
                          </span>
                        )}
                      </td>

                      {/* 9. FALTAS NO POE - IDENTIFICAÇÃO DO POLICIAL FALTOSO. */}
                      <td className="py-2.5 px-3 align-top">
                        {renderPolicialItems(faltasTexto, 'falta')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Exibindo</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              de <strong>{filteredFaltas.length}</strong> linha(s) da planilha
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-0.5 font-bold text-slate-800">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
