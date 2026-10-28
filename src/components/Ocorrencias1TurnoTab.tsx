import React, { useState, useMemo, useEffect } from 'react';
import {
  FileDown,
  Search,
  X,
  RefreshCw,
  Link2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Building2,
  Shield,
  Eye,
  Copy,
  Check,
  Clock,
  Calendar,
  Filter,
} from 'lucide-react';
import { Ocorrencia } from '../types';
import { exportOcorrencias1TurnoPdf } from '../services/pdfService';
import { normalizeCpaName, parseOcorrencias1TurnoCsv, fetchCsvWithTimeout } from '../services/sheetService';
import { DEFAULT_1TURNO_OCORRENCIAS_URL, INITIAL_1TURNO_OCORRENCIAS } from '../data/ocorrencias1TurnoData';

const STORAGE_1TURNO_URL_KEY = 'eleicoes2026_1turno_custom_url_v1';
const STORAGE_1TURNO_DATA_KEY = 'eleicoes2026_1turno_custom_data_v1';

export function Ocorrencias1TurnoTab() {
  // 1. URL da planilha do 1º Turno (salva no localStorage do navegador)
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_1TURNO_URL_KEY) || DEFAULT_1TURNO_OCORRENCIAS_URL;
    } catch {
      return DEFAULT_1TURNO_OCORRENCIAS_URL;
    }
  });

  const [inputUrl, setInputUrl] = useState<string>(sheetUrl);
  const [isUrlPanelOpen, setIsUrlPanelOpen] = useState<boolean>(false);

  // 2. Dados das Ocorrências do 1º Turno
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_1TURNO_DATA_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_1TURNO_OCORRENCIAS;
  });

  // 3. Estados de sincronização e feedback
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // 4. Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cpaFilter, setCpaFilter] = useState<string>('TODOS');
  const [diaFilter, setDiaFilter] = useState<'TODOS' | '03OUT' | '04OUT'>('TODOS');
  const [crimeFilter, setCrimeFilter] = useState<string>('TODOS');

  // 5. Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // 6. Modal de detalhes
  const [selectedOcorrencia, setSelectedOcorrencia] = useState<Ocorrencia | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Função de sincronização com o link da planilha
  const handleSyncSheet = async (customUrl?: string) => {
    const target = (customUrl !== undefined ? customUrl : sheetUrl).trim();
    if (!target) {
      showToast('Por favor, informe um link válido da Planilha Google.', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const csvText = await fetchCsvWithTimeout(target);
      const parsed = parseOcorrencias1TurnoCsv(csvText);

      if (parsed && parsed.length > 0) {
        setOcorrencias(parsed);
        try {
          localStorage.setItem(STORAGE_1TURNO_DATA_KEY, JSON.stringify(parsed));
          localStorage.setItem(STORAGE_1TURNO_URL_KEY, target);
        } catch {}
        setSheetUrl(target);
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(now);
        showToast(`Planilha do 1º Turno sincronizada com sucesso! (${parsed.length} ocorrências)`, 'success');
        setIsUrlPanelOpen(false);
      } else {
        showToast('Nenhuma ocorrência válida encontrada no link fornecido.', 'error');
      }
    } catch (err: any) {
      console.error('Erro na sincronização do 1º Turno:', err);
      showToast('Não foi possível ler a planilha. Verifique se o link possui permissão de leitura.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveAndSyncUrl = (e: React.FormEvent) => {
    e.preventDefault();
    handleSyncSheet(inputUrl);
  };

  const handleResetDefaultUrl = () => {
    setInputUrl(DEFAULT_1TURNO_OCORRENCIAS_URL);
    handleSyncSheet(DEFAULT_1TURNO_OCORRENCIAS_URL);
  };

  // Filtragem inteligente em tempo real
  const filteredOcorrencias = useMemo(() => {
    return ocorrencias.filter((o) => {
      // Filtro de CPA
      if (cpaFilter !== 'TODOS') {
        const cpaNorm = normalizeCpaName(o.comandoIntermediario || o.cpa || '');
        if (cpaNorm !== cpaFilter) return false;
      }

      // Filtro de Dia
      if (diaFilter !== 'TODOS') {
        const s = `${o.carimbo || ''} ${o.servicoDia || ''} ${o.dataHoraFato || ''}`.toLowerCase();
        if (diaFilter === '03OUT') {
          const match03 = s.includes('03/10') || s.includes('03out') || s.includes('sábado') || s.includes('sabado');
          if (!match03) return false;
        } else if (diaFilter === '04OUT') {
          const match04 = s.includes('04/10') || s.includes('04out') || s.includes('domingo');
          if (!match04) return false;
        }
      }

      // Filtro de Crime
      if (crimeFilter !== 'TODOS') {
        const crimesStr = `${o.tipo || ''} ${o.seHouverOcorrenciaDizerQual || ''} ${(o.crimesRegistrados || []).join(' ')}`.toLowerCase();
        if (!crimesStr.includes(crimeFilter.toLowerCase())) return false;
      }

      // Busca textual
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const fullText = [
          o.carimbo,
          o.opm,
          o.comandoIntermediario,
          o.cpa,
          o.tipo,
          o.local,
          o.bopm,
          o.ro,
          o.dinamica,
          o.informante,
          o.posto,
          o.nomeGuerra,
          o.rg,
          ...(o.crimesRegistrados || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!fullText.includes(q)) return false;
      }

      return true;
    });
  }, [ocorrencias, cpaFilter, diaFilter, crimeFilter, searchTerm]);

  // Estatísticas rápidas
  const stats = useMemo(() => {
    let sabadoCount = 0;
    let domingoCount = 0;
    let bocaDeUrnaCount = 0;
    let prisoesCount = 0;

    ocorrencias.forEach((o) => {
      const s = `${o.carimbo || ''} ${o.servicoDia || ''} ${o.dataHoraFato || ''}`.toLowerCase();
      if (s.includes('03/10') || s.includes('03out')) sabadoCount++;
      if (s.includes('04/10') || s.includes('04out')) domingoCount++;

      const del = `${o.tipo || ''} ${o.seHouverOcorrenciaDizerQual || ''} ${(o.crimesRegistrados || []).join(' ')}`.toLowerCase();
      if (del.includes('boca de urna')) bocaDeUrnaCount++;
      if (del.includes('pris') || del.includes('apreens') || del.includes('detid')) prisoesCount++;
    });

    return {
      total: ocorrencias.length,
      sabadoCount,
      domingoCount,
      bocaDeUrnaCount,
      prisoesCount,
    };
  }, [ocorrencias]);

  // Lista única de CPAs para o filtro
  const availableCpas = useMemo(() => {
    const set = new Set<string>();
    ocorrencias.forEach((o) => {
      const c = normalizeCpaName(o.comandoIntermediario || o.cpa || '');
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [ocorrencias]);

  // Lista única de Delitos para o filtro
  const availableCrimes = useMemo(() => {
    const set = new Set<string>();
    ocorrencias.forEach((o) => {
      if (o.crimesRegistrados && o.crimesRegistrados.length > 0) {
        o.crimesRegistrados.forEach((c) => {
          if (c && c !== 'Não houve') set.add(c.trim());
        });
      } else if (o.tipo && o.tipo !== 'Não houve') {
        set.add(o.tipo.trim());
      }
    });
    return Array.from(set).sort();
  }, [ocorrencias]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredOcorrencias.length / itemsPerPage));
  const paginatedOcorrencias = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOcorrencias.slice(start, start + itemsPerPage);
  }, [filteredOcorrencias, currentPage, itemsPerPage]);

  const handleCopyFicha = (oc: Ocorrencia) => {
    const text = [
      '=== OCORRÊNCIA ELEIÇÕES 2026 (1º TURNO) ===',
      `Data/Hora: ${oc.carimbo || oc.dataHoraFato || '-'}`,
      `Comando: ${normalizeCpaName(oc.comandoIntermediario || oc.cpa || '')}`,
      `OPM: ${oc.opm || oc.uop || '-'}`,
      `Delito: ${oc.tipo || oc.seHouverOcorrenciaDizerQual || 'Não informado'}`,
      `Local: ${oc.local || '-'}`,
      `Hora do Fato: ${oc.hora || '-'}`,
      `BOPM: ${oc.bopm || '-'} | RO: ${oc.ro || '-'}`,
      `Informante: ${oc.posto || ''} ${oc.nomeGuerra || ''} ${oc.rg ? `(RG: ${oc.rg})` : ''}`.trim() || '-',
      '----------------------------------------',
      'DINÂMICA DOS FATOS:',
      oc.dinamica || oc.historico || 'Sem detalhes.',
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(oc.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportPdf = () => {
    exportOcorrencias1TurnoPdf(filteredOcorrencias, {
      dia: diaFilter,
      cpa: cpaFilter,
      crimeFilter: crimeFilter !== 'TODOS' ? crimeFilter : undefined,
      search: searchTerm || undefined,
    });
  };

  return (
    <div className="space-y-5">
      {/* Toast de notificação flutuante */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold tracking-wide transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-800 text-white border border-emerald-600'
              : toastMessage.type === 'error'
              ? 'bg-rose-800 text-white border border-rose-600'
              : 'bg-slate-800 text-white border border-slate-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* CABEÇALHO DA ABA DO 1º TURNO */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                1º TURNO OFICIAL
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Plebiscito de 03/10 (Sábado) e 04/10 (Domingo) de 2026
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">
              Ocorrências Operacionais — 1º Turno Eleições 2026
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Base oficial de registros de vulto e incidentes eleitorais consolidados pelo EMG-PM/3.
            </p>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsUrlPanelOpen(!isUrlPanelOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                isUrlPanelOpen
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Configurar ou alterar link da planilha do 1º Turno"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Link da Planilha</span>
            </button>

            <button
              onClick={() => handleSyncSheet()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
              title="Recarregar dados diretamente da planilha do Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Lendo...' : 'Sincronizar'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition-all active:scale-95"
              title="Gerar e baixar o Relatório Oficial em PDF padrão PMERJ / EMG-PM/3"
            >
              <FileDown className="w-4 h-4 text-blue-200" />
              <span>Baixar Relatório Oficial (PDF)</span>
            </button>
          </div>
        </div>

        {/* Card Informativo com Contadores Rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/60">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase">
              <span>Total no 1º Turno</span>
              <Shield className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {stats.total.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {filteredOcorrencias.length !== stats.total
                ? `${filteredOcorrencias.length} no filtro atual`
                : '100% computadas'}
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-lg p-3 border border-blue-200/60">
            <div className="flex items-center justify-between text-blue-800 text-[11px] font-semibold uppercase">
              <span>Boca de Urna</span>
              <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-black text-blue-950 mt-1">
              {stats.bocaDeUrnaCount}
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5">
              Maior incidência eleitoral
            </div>
          </div>

          <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200/60">
            <div className="flex items-center justify-between text-amber-800 text-[11px] font-semibold uppercase">
              <span>Prisões / Apreensões</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-950 mt-1">
              {stats.prisoesCount}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              Conduções registradas
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/60">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase">
              <span>Distribuição por Dia</span>
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1.5 flex justify-between">
              <span>03/10 (Sáb): <strong className="text-blue-900">{stats.sabadoCount}</strong></span>
              <span>04/10 (Dom): <strong className="text-blue-900">{stats.domingoCount}</strong></span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {lastSyncTime ? `Sincronizado às ${lastSyncTime}` : 'Base ativa pronta'}
            </div>
          </div>
        </div>

        {/* PAINEL DE CONFIGURAÇÃO DO LINK DA PLANILHA DO 1º TURNO */}
        {isUrlPanelOpen && (
          <form
            onSubmit={handleSaveAndSyncUrl}
            className="mt-4 p-4 rounded-lg bg-blue-50/50 border border-blue-200 space-y-3 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                <Link2 className="w-4 h-4 text-blue-600" />
                <span>Link da Planilha Google (1º Turno)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsUrlPanelOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você pode colar aqui qualquer link direto ou aba compartilhada de planilha do Google Sheets com respostas de ocorrências do 1º Turno. O sistema salvará este link permanentemente no seu navegador.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                required
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-600 text-white shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {isSyncing ? 'Carregando...' : 'Salvar e Ler Planilha'}
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaultUrl}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                >
                  Restaurar Padrão
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Campo de Busca Livre */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por OPM, Delito, RO, BOPM ou palavra na dinâmica..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por CPA */}
          <div className="lg:col-span-2">
            <select
              value={cpaFilter}
              onChange={(e) => {
                setCpaFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 font-medium"
            >
              <option value="TODOS">Todos os CPAs</option>
              {availableCpas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Dia */}
          <div className="lg:col-span-2">
            <select
              value={diaFilter}
              onChange={(e) => {
                setDiaFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 font-medium"
            >
              <option value="TODOS">Todos os Dias</option>
              <option value="03OUT">03/10 (Sábado)</option>
              <option value="04OUT">04/10 (Domingo)</option>
            </select>
          </div>

          {/* Filtro por Crime / Delito */}
          <div className="lg:col-span-3">
            <select
              value={crimeFilter}
              onChange={(e) => {
                setCrimeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 font-medium"
            >
              <option value="TODOS">Todas as Tipificações</option>
              {availableCrimes.map((crime) => (
                <option key={crime} value={crime}>
                  {crime}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumo da filtragem */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <div>
            Mostrando <strong>{filteredOcorrencias.length}</strong> de <strong>{ocorrencias.length}</strong> ocorrências
            {(cpaFilter !== 'TODOS' || diaFilter !== 'TODOS' || crimeFilter !== 'TODOS' || searchTerm) && (
              <button
                onClick={() => {
                  setCpaFilter('TODOS');
                  setDiaFilter('TODOS');
                  setCrimeFilter('TODOS');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="ml-3 text-blue-600 hover:underline font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Exibir por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs py-1 px-2 border border-slate-300 rounded bg-white text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE OCORRÊNCIAS DO 1º TURNO */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-12 text-center">Nº</th>
                <th className="py-3 px-3 w-36">Carimbo / Turno</th>
                <th className="py-3 px-3 w-32">CPA / OPM</th>
                <th className="py-3 px-3 w-48">Delito / Tipificação</th>
                <th className="py-3 px-3 w-40">Local / Hora</th>
                <th className="py-3 px-3 w-32">BOPM / RO</th>
                <th className="py-3 px-4">Dinâmica da Ocorrência</th>
                <th className="py-3 px-3 w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOcorrencias.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm">Nenhuma ocorrência encontrada para os filtros selecionados.</p>
                    <p className="text-xs mt-1">Tente remover alguns filtros ou limpar o termo de busca.</p>
                  </td>
                </tr>
              ) : (
                paginatedOcorrencias.map((oc, idx) => {
                  const itemIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                  const cpaClean = normalizeCpaName(oc.comandoIntermediario || oc.cpa || '');
                  const isBocaDeUrna = (oc.tipo || '').toLowerCase().includes('boca de urna');
                  const isPrisao = (oc.tipo || '').toLowerCase().includes('pris');

                  return (
                    <tr
                      key={oc.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOcorrencia(oc)}
                    >
                      {/* Nº */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                        {itemIndex}
                      </td>

                      {/* Carimbo */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 font-mono text-[11px]">
                          {oc.carimbo || oc.dataHoraFato || '-'}
                        </div>
                        {oc.servicoDia && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[130px]" title={oc.servicoDia}>
                            {oc.servicoDia.includes('03OUT') ? '03/10 (Sáb)' : oc.servicoDia.includes('04OUT') ? '04/10 (Dom)' : oc.servicoDia}
                          </div>
                        )}
                      </td>

                      {/* CPA / OPM */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-800">
                          {cpaClean}
                        </span>
                        <div className="font-bold text-slate-800 text-[11px] mt-0.5">
                          {oc.opm || oc.uop || '-'}
                        </div>
                      </td>

                      {/* Delito / Tipificação */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isBocaDeUrna
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : isPrisao
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-300'
                            }`}
                          >
                            {oc.tipo || oc.seHouverOcorrenciaDizerQual || 'Sem alteração'}
                          </span>
                        </div>
                        {oc.informante && (
                          <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[170px]" title={oc.informante}>
                            Inf: {oc.informante}
                          </div>
                        )}
                      </td>

                      {/* Local / Hora */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 text-[11px] line-clamp-2" title={oc.local}>
                          {oc.local || 'Local não informado'}
                        </div>
                        {oc.hora && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{oc.hora}</span>
                          </div>
                        )}
                      </td>

                      {/* BOPM / RO */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {oc.bopm && oc.bopm !== 'Não informado' ? (
                          <div className="text-slate-800 font-semibold truncate" title={`BOPM: ${oc.bopm}`}>
                            <span className="text-[9px] text-slate-400 uppercase font-sans">BOPM: </span>
                            {oc.bopm}
                          </div>
                        ) : null}
                        {oc.ro && oc.ro !== 'Não informado' ? (
                          <div className="text-slate-700 truncate" title={`RO: ${oc.ro}`}>
                            <span className="text-[9px] text-slate-400 uppercase font-sans">RO: </span>
                            {oc.ro}
                          </div>
                        ) : (
                          !oc.bopm && <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Dinâmica */}
                      <td className="py-2.5 px-4 text-slate-700 leading-relaxed">
                        <div className="line-clamp-2 text-[11px]" title={oc.dinamica || oc.historico}>
                          {oc.dinamica || oc.historico || 'Sem detalhes informados.'}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedOcorrencia(oc)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Ver ficha completa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyFicha(oc)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Copiar texto da ocorrência"
                          >
                            {copiedId === oc.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* CONTROLES DE PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <span>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredOcorrencias.length} ocorrências)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES COMPLETOS DA OCORRÊNCIA */}
      {selectedOcorrencia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedOcorrencia(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Ficha de Ocorrência — 1º Turno (03 e 04 de Outubro de 2026)
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {normalizeCpaName(selectedOcorrencia.comandoIntermediario || selectedOcorrencia.cpa || '')} — {selectedOcorrencia.opm || selectedOcorrencia.uop || 'OPM'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOcorrencia(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Data / Hora:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {selectedOcorrencia.carimbo || selectedOcorrencia.dataHoraFato || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Serviço do Dia:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedOcorrencia.servicoDia || 'Serviço POE Eleições'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Delito Informado:</span>
                  <span className="font-bold text-blue-900">
                    {selectedOcorrencia.tipo || selectedOcorrencia.seHouverOcorrenciaDizerQual || 'Sem alteração'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Hora da Ocorrência:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {selectedOcorrencia.hora || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">BOPM:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {selectedOcorrencia.bopm || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">RO / Delegacia:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {selectedOcorrencia.ro || 'Não informado'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Local do Fato:</span>
                  <span className="font-medium text-slate-900">
                    {selectedOcorrencia.local || 'Local não informado'}
                  </span>
                </div>
                {selectedOcorrencia.informante && (
                  <div className="col-span-2 border-t border-slate-200/80 pt-2 mt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Informante:</span>
                    <span className="font-medium text-slate-800">
                      {selectedOcorrencia.informante}
                      {selectedOcorrencia.email ? ` • ${selectedOcorrencia.email}` : ''}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800 uppercase block mb-1">
                  Dinâmica dos Fatos / Histórico Operacional:
                </span>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 leading-relaxed font-sans whitespace-pre-wrap select-text">
                  {selectedOcorrencia.dinamica || selectedOcorrencia.historico || 'Sem detalhes informados.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleCopyFicha(selectedOcorrencia)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
              >
                {copiedId === selectedOcorrencia.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Texto Completo</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setSelectedOcorrencia(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
