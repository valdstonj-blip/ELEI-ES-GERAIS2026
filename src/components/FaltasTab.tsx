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
  RefreshCw,
  Link2,
  User,
  Shield,
  Eye,
  FileText,
  Clock,
  BarChart3,
  Table,
  Filter,
} from 'lucide-react';
import { FaltaEfetivo } from '../types';
import { exportFaltasPdf, matchesCarimboDate } from '../services/pdfService';
import { normalizeCpaName } from '../services/sheetService';

interface FaltasTabProps {
  faltas: FaltaEfetivo[];
  onAddFalta?: (nova: FaltaEfetivo) => void;
  lastSyncTime?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  onOpenSettings?: () => void;
}

// Função utilitária precisa para detectar se o texto expressa ausência de falta / sem alteração
export function isSemAlteracaoFalta(text: string | undefined | null): boolean {
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

// Função utilitária precisa para contar policiais em texto com delimitadores (ex: ponto e vírgula)
export function countPoliciaisInText(text: string | undefined | null): number {
  if (!text) return 0;
  if (isSemAlteracaoFalta(text)) return 0;

  const items = text
    .split(/[;\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && !isSemAlteracaoFalta(s));
  return items.length > 0 ? items.length : 1;
}

export const FaltasTab: React.FC<FaltasTabProps> = ({
  faltas,
  lastSyncTime,
  onSync,
  isSyncing,
  onOpenSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCpa, setSelectedCpa] = useState('TODOS');
  const [selectedOpm, setSelectedOpm] = useState('TODAS');
  const [selectedDay, setSelectedDay] = useState<'TODOS' | '03OUT' | '04OUT'>('TODOS');
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalFalta, setModalFalta] = useState<FaltaEfetivo | null>(null);

  // Consolidação detalhada de Faltas por Comando Intermediário (CPA)
  const cpaFaltasStats = useMemo(() => {
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

    const map: Record<
      string,
      {
        comando: string;
        totalFaltas: number;
        totalEnvios: number;
        semAlteracao: number;
        comFaltas: number;
        opmsComFaltas: string[];
      }
    > = {};

    standardComandos.forEach((cmd) => {
      map[cmd] = {
        comando: cmd,
        totalFaltas: 0,
        totalEnvios: 0,
        semAlteracao: 0,
        comFaltas: 0,
        opmsComFaltas: [],
      };
    });

    faltas.forEach((f) => {
      const cpaName = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      if (!cpaName) return;

      if (!map[cpaName]) {
        map[cpaName] = {
          comando: cpaName,
          totalFaltas: 0,
          totalEnvios: 0,
          semAlteracao: 0,
          comFaltas: 0,
          opmsComFaltas: [],
        };
      }

      // Se houver filtro de dia aplicado, respeita também no consolidado por CPA
      if (selectedDay !== 'TODOS') {
        const fallbackText = `${f.servicoDia || ''} ${f.turno || ''}`;
        if (!matchesCarimboDate(f.carimbo, selectedDay, fallbackText)) {
          return;
        }
      }

      const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);
      map[cpaName].totalEnvios += 1;
      map[cpaName].totalFaltas += qtd;

      if (qtd > 0) {
        map[cpaName].comFaltas += 1;
        const opmName = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
        if (opmName && !map[cpaName].opmsComFaltas.includes(opmName)) {
          map[cpaName].opmsComFaltas.push(opmName);
        }
      } else {
        map[cpaName].semAlteracao += 1;
      }
    });

    return Object.values(map).sort((a, b) => {
      const idxA = standardComandos.indexOf(a.comando);
      const idxB = standardComandos.indexOf(b.comando);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.comando.localeCompare(b.comando);
    });
  }, [faltas, selectedDay]);

  // Totais consolidados do quadro por CPA
  const cpaTotals = useMemo(() => {
    let faltasTot = 0;
    let enviosTot = 0;
    let semAltTot = 0;
    let comFaltasTot = 0;
    const allOpmsComFaltas = new Set<string>();

    cpaFaltasStats.forEach((item) => {
      faltasTot += item.totalFaltas;
      enviosTot += item.totalEnvios;
      semAltTot += item.semAlteracao;
      comFaltasTot += item.comFaltas;
      item.opmsComFaltas.forEach((opm) => allOpmsComFaltas.add(opm));
    });

    return {
      faltasTot,
      enviosTot,
      semAltTot,
      comFaltasTot,
      opmsTot: allOpmsComFaltas.size,
    };
  }, [cpaFaltasStats]);

  const availableCpas = useMemo(() => {
    const set = new Set(
      faltas
        .map((f) => normalizeCpaName(f.comandoIntermediario || f.cpa || ''))
        .filter(Boolean)
    );
    return ['TODOS', ...Array.from(set).sort()];
  }, [faltas]);

  const availableOpms = useMemo(() => {
    const set = new Set(
      faltas.map((f) => f.opm || f.uopDestino || f.opmOrigem).filter(Boolean)
    );
    return ['TODAS', ...Array.from(set).sort()];
  }, [faltas]);

  // Filtragem precisa em todas as colunas com foco estrito no CARIMBO DE DATA E HORA e no SERVIÇO DO DIA
  const filteredFaltas = useMemo(() => {
    return faltas.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      if (selectedCpa !== 'TODOS' && cpaVal !== selectedCpa) return false;

      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      if (selectedOpm !== 'TODAS' && opmVal !== selectedOpm) return false;

      // Filtro de Dia focado no Carimbo de Data e Hora e no Serviço do Dia
      if (selectedDay !== 'TODOS') {
        const fallbackText = `${f.servicoDia || ''} ${f.turno || ''}`;
        if (!matchesCarimboDate(f.carimbo, selectedDay, fallbackText)) {
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
  }, [faltas, selectedCpa, selectedOpm, selectedDay, searchTerm]);

  const totalPages = Math.ceil(filteredFaltas.length / itemsPerPage) || 1;
  const paginatedFaltas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFaltas.slice(start, start + itemsPerPage);
  }, [filteredFaltas, currentPage, itemsPerPage]);

  // Totalização exata da quantidade de policiais faltosos
  const stats = useMemo(() => {
    const totalEnvios = faltas.length;
    let totalPoliciaisFaltosos = 0;
    const opmsComFaltasSet = new Set<string>();

    faltas.forEach((f) => {
      const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);
      totalPoliciaisFaltosos += qtd;
      if (qtd > 0) {
        const opmName = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
        if (opmName) opmsComFaltasSet.add(opmName);
      }
    });

    const opmsCount = opmsComFaltasSet.size;

    return { totalEnvios, totalPoliciaisFaltosos, opmsCount };
  }, [faltas]);

  // Renderizador ajustado para os textos dos policiais faltosos
  const renderPolicialChips = (rawText: string | undefined) => {
    const text = (rawText || '').trim();

    if (!text || isSemAlteracaoFalta(text)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Sem alteração</span>
        </span>
      );
    }

    const items = text
      .split(/[;\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && !isSemAlteracaoFalta(s));

    if (items.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Sem alteração</span>
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-semibold leading-tight shadow-2xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>{item}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div id="faltas-dashboard" className="space-y-3.5">
      {/* 0. CARDS DE RESUMO OPERACIONAL + STATUS DE CONEXÃO DA PLANILHA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Total de Envios
            </span>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-900">
              {stats.totalEnvios}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Respostas na planilha
            </span>
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">
              Total Policiais Faltosos
            </span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-rose-700">
              {stats.totalPoliciaisFaltosos}
            </span>
            <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
              {stats.totalPoliciaisFaltosos === 1
                ? '1 policial faltoso'
                : `${stats.totalPoliciaisFaltosos} policiais faltosos`}
            </span>
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
              OPMs com Faltas
            </span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-indigo-800">
              {stats.opmsCount}
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
              Batalhões e unidades registradas
            </span>
          </div>
        </div>

        {/* Card de Conexão com Google Sheets */}
        <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Planilha Google</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              {lastSyncTime || 'Conectada'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {onSync && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                title="Sincronizar dados com a Planilha de Faltas agora"
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Atualizando...' : 'Atualizar'}</span>
              </button>
            )}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Conectar ou alterar link da planilha"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200 flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Link</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QUADRO RÁPIDO DE COMANDOS INTERMEDIÁRIOS (CPA) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-700" />
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              Comandos Intermediários (CPA)
            </span>
            {selectedCpa !== 'TODOS' && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-900 font-bold border border-rose-200">
                Filtro: {selectedCpa}
              </span>
            )}
          </div>
          {selectedCpa !== 'TODOS' && (
            <button
              onClick={() => {
                setSelectedCpa('TODOS');
                setSelectedOpm('TODAS');
                setCurrentPage(1);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
            >
              Limpar Filtro
            </button>
          )}
        </div>

        {/* Grade de Botões dos Comandos Intermediários */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-1.5 text-xs">
          {cpaFaltasStats.map((item) => {
            const isSelected = selectedCpa === item.comando;
            const hasFaltas = item.totalFaltas > 0;

            return (
              <button
                key={item.comando}
                onClick={() => {
                  setSelectedCpa(isSelected ? 'TODOS' : item.comando);
                  setSelectedOpm('TODAS');
                  setCurrentPage(1);
                }}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400'
                    : hasFaltas
                    ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-300 text-rose-950 shadow-2xs'
                    : 'bg-slate-50 hover:bg-blue-50/50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-black text-xs truncate ${isSelected ? 'text-white' : hasFaltas ? 'text-rose-950' : 'text-slate-900'}`}>
                    {item.comando}
                  </span>
                  {hasFaltas && !isSelected && (
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  )}
                </div>

                <div className="mt-1 flex items-baseline justify-between">
                  <span className={`text-base font-black font-mono ${
                    isSelected ? 'text-white' : hasFaltas ? 'text-rose-700 font-black' : 'text-slate-500 font-bold'
                  }`}>
                    {item.totalFaltas}
                  </span>
                  <span className={`text-[10px] font-semibold ${
                    isSelected ? 'text-blue-100' : hasFaltas ? 'text-rose-700 font-bold' : 'text-slate-400'
                  }`}>
                    {item.totalFaltas === 1 ? 'falta' : 'faltas'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS: BUSCA, FILTROS DE DIA (03OUT / 04OUT), CPA, OPM E PDF */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Busca Rápida */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por policial faltoso, RG, informante, comando, OPM, serviço ou carimbo..."
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

          {/* Filtro de Dias: 03OUT26 e 04OUT26 */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 shrink-0">
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
              03OUT26 (Sábado)
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
              04OUT26 (Domingo)
            </button>
          </div>

          {/* Seletores CPA e OPM */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
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

            {/* Menu Dropdown de Exportação em PDF com Filtros de CPA e OPM */}
            <div className="relative inline-block text-left">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() =>
                    exportFaltasPdf(faltas, {
                      dia: selectedDay,
                      cpa: selectedCpa,
                      opm: selectedOpm,
                      search: searchTerm,
                    })
                  }
                  title={`Baixar PDF de Faltas filtrado por Comando (${selectedCpa}), OPM (${selectedOpm}) e Período (${selectedDay})`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-l-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    {selectedOpm !== 'TODAS'
                      ? `Exportar PDF (${selectedOpm})`
                      : selectedCpa !== 'TODOS'
                      ? `Exportar PDF (${selectedCpa})`
                      : selectedDay !== 'TODOS'
                      ? `Exportar PDF (${selectedDay})`
                      : 'Exportar PDF Geral'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfDropdownOpen((prev) => !prev)}
                  title="Mais opções de download por período e filtros"
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
                  <div className="origin-top-right absolute right-0 mt-1 w-64 rounded-lg shadow-lg bg-white ring-1 ring-black/5 divide-y divide-slate-100 z-30">
                    <div className="p-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-t-lg">
                      {selectedCpa !== 'TODOS' || selectedOpm !== 'TODAS'
                        ? `Filtrado: ${selectedOpm !== 'TODAS' ? selectedOpm : selectedCpa}`
                        : 'Relatório em PDF:'}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, {
                            dia: '03OUT',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            search: searchTerm,
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span className="truncate">PDF 03OUT26 {selectedOpm !== 'TODAS' ? `(${selectedOpm})` : selectedCpa !== 'TODOS' ? `(${selectedCpa})` : ''}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono shrink-0 ml-1">
                          03/10
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, {
                            dia: '04OUT',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            search: searchTerm,
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span className="truncate">PDF 04OUT26 {selectedOpm !== 'TODAS' ? `(${selectedOpm})` : selectedCpa !== 'TODOS' ? `(${selectedCpa})` : ''}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono shrink-0 ml-1">
                          04/10
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          exportFaltasPdf(faltas, {
                            dia: 'TODOS',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            search: searchTerm,
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span className="truncate">Todos os Dias {selectedOpm !== 'TODAS' ? `(${selectedOpm})` : selectedCpa !== 'TODOS' ? `(${selectedCpa})` : ''}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono shrink-0 ml-1">
                          Filtrado
                        </span>
                      </button>
                    </div>

                    {(selectedCpa !== 'TODOS' || selectedOpm !== 'TODAS') && (
                      <div className="py-1 bg-slate-50/50">
                        <button
                          onClick={() => {
                            exportFaltasPdf(faltas, {
                              dia: 'TODOS',
                              cpa: 'TODOS',
                              opm: 'TODAS',
                            });
                            setPdfDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 flex items-center justify-between font-semibold cursor-pointer"
                        >
                          <span>PDF Geral (Todo o Estado)</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                            Total
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABELA DE REGISTROS ANALÍTICOS (DETALHADO LINHA A LINHA DA PLANILHA) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[560px]">
          <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider shadow-xs">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] bg-slate-900">
                  CARIMBO DATA HORA
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[180px] bg-slate-900">
                  SERVIÇO DO DIA
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[170px] bg-slate-900">
                  INFORMANTE (PM)
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                  COMANDO
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                  OPM
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                  TOTAL FALTAS
                </th>
                <th className="py-2.5 px-3 min-w-[420px] bg-slate-900">
                  POLICIAIS FALTOSOS NO POE (IDENTIFICAÇÃO)
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[85px] text-center bg-slate-900">
                  FICHA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFaltas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum registro de envio da planilha encontrado.
                  </td>
                </tr>
              ) : (
                paginatedFaltas.map((f, idx) => {
                  const carimboText = f.carimbo || f.data;
                  const servicoText = f.servicoDia || f.turno;
                  const cpaText = normalizeCpaName(f.comandoIntermediario || f.cpa || '2º CPA');
                  const opmText = f.opm || f.uopDestino || f.opmOrigem || '9º BPM';
                  const faltasTexto = f.faltasPoe || f.motivo;
                  const qtdFaltasLinha = countPoliciaisInText(faltasTexto);

                  const informanteDesc = [
                    f.posto || f.postoGrad,
                    f.nomeGuerra,
                    f.rg ? `(RG ${f.rg})` : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

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
                        <span className="font-semibold leading-snug block">
                          {servicoText}
                        </span>
                      </td>

                      {/* 3. INFORMANTE */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        {informanteDesc ? (
                          <div className="text-slate-800">
                            <span className="font-bold block text-[11px]">
                              {f.posto || f.postoGrad} {f.nomeGuerra}
                            </span>
                            {f.rg && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                RG: {f.rg}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* 4. COMANDO INTERMEDIÁRIO */}
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                          {cpaText}
                        </span>
                      </td>

                      {/* 5. OPM */}
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold">
                          {opmText}
                        </span>
                      </td>

                      {/* 6. TOTAL FALTAS (LINHA) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                        {qtdFaltasLinha > 0 ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{qtdFaltasLinha} Falta(s)</span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-medium">
                            0 Faltas
                          </span>
                        )}
                      </td>

                      {/* 7. FALTAS NO POE - IDENTIFICAÇÃO DO POLICIAL FALTOSO */}
                      <td className="py-2.5 px-3 align-top">
                        {renderPolicialChips(faltasTexto)}
                      </td>

                      {/* 8. FICHA / DETALHES */}
                      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                        <button
                          onClick={() => setModalFalta(f)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                          title="Ver ficha completa com todos os campos deste envio"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ficha</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando {paginatedFaltas.length} de {filteredFaltas.length} registros
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-900">
                {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. MODAL COM A FICHA COMPLETA DO ENVIO DE FALTAS */}
      {modalFalta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Cabeçalho do Modal */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white uppercase">
                    Ficha Completa de Envio de Faltas no POE
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Carimbo: {modalFalta.carimbo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalFalta(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Informante & Unidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Policial Militar Informante</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {modalFalta.posto || modalFalta.postoGrad || 'Policial Militar'} {modalFalta.nomeGuerra || '-'}
                  </div>
                  {modalFalta.rg && (
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      RG PM: {modalFalta.rg}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Unidade & Serviço</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {normalizeCpaName(modalFalta.comandoIntermediario || modalFalta.cpa || '')} • {modalFalta.opm || modalFalta.uopDestino || '-'}
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5 font-medium">
                    {modalFalta.servicoDia || modalFalta.turno || 'Serviço POE Eleições'}
                  </div>
                </div>
              </div>

              {/* Relação de Faltas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Relação de Policiais Faltosos (POE)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                    {countPoliciaisInText(modalFalta.faltasPoe || modalFalta.motivo)} falta(s)
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {renderPolicialChips(modalFalta.faltasPoe || modalFalta.motivo)}
                </div>
              </div>

              {/* Dispensas (se houver) */}
              {modalFalta.dispensasPoe && modalFalta.dispensasPoe !== 'sem alteração' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dispensas Registradas no POE</span>
                  </span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {modalFalta.dispensasPoe}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setModalFalta(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
