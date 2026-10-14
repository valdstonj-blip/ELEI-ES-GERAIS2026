import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  FileDown,
  Search,
  X,
  RefreshCw,
  Building2,
  Calendar,
  Link,
  Users,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { FaltaEfetivo } from '../types';
import { normalizeCpaName, fetchCsvWithTimeout, parseFaltasCsv } from '../services/sheetService';
import { countPoliciaisInText } from './FaltasTab';
import { exportVerificacaoPdf } from '../services/pdfVerificacaoService';
import { CsvHelper } from '../lib/csvHelper';
import { RAW_VERIFICACAO_CSV } from '../data/rawVerificacaoCsv';
import { matchesCarimboDate } from '../services/pdfService';

interface VerificacaoTabProps {
  faltas?: FaltaEfetivo[];
  onUpdateFaltas?: (data: FaltaEfetivo[]) => void;
  lastSyncTime?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  isAdmin?: boolean;
}

export const VerificacaoTab: React.FC<VerificacaoTabProps> = ({
  faltas: initialFaltas,
  onUpdateFaltas,
  lastSyncTime,
  onSync,
  isSyncing = false,
  isAdmin = true,
}) => {
  // Dados de faltas da tela de verificação (se não passados, obtém do CsvHelper)
  const [internalFaltas, setInternalFaltas] = useState<FaltaEfetivo[]>(() => {
    if (initialFaltas && initialFaltas.length > 0) return initialFaltas;
    return CsvHelper.getStoredVerificacao();
  });

  // Atualiza estado interno caso a prop mude
  React.useEffect(() => {
    if (initialFaltas && initialFaltas.length > 0) {
      setInternalFaltas(initialFaltas);
    }
  }, [initialFaltas]);

  // Filtros (Exclusivo 2º Turno: 24 e 25 de Outubro; nunca 03 ou 04 de Outubro)
  const [selectedCpa, setSelectedCpa] = useState<string>('TODOS');
  const [selectedOpm, setSelectedOpm] = useState<string>('TODAS');
  const [selectedDay, setSelectedDay] = useState<'TODOS' | '24OUT' | '25OUT'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modo de visualização: 'CONSOLIDADO' (tabelas CPA e OPM) | 'ANALITICO' (envios detalhados) | 'COMPLETO' (ambos)
  const [viewMode, setViewMode] = useState<'COMPLETO' | 'CONSOLIDADO' | 'ANALITICO'>('COMPLETO');

  // Modal de configuração de link específico da tela de verificação
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState<string>(() => CsvHelper.getVerificacaoSheetUrl());
  const [urlStatus, setUrlStatus] = useState<{ loading: boolean; message: string; error?: boolean } | null>(null);

  // Modal para inspecionar envio individual
  const [selectedEnvio, setSelectedEnvio] = useState<{
    idx: number;
    opm: string;
    cpa: string;
    carimbo: string;
    email: string;
    oficial: string;
    texto: string;
    qtd: number;
  } | null>(null);

  // Paginação da tabela analítica
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Lista de CPAs padrão na ordem oficial da corporação
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

  // Disponíveis para filtros
  const availableCpas = useMemo(() => {
    const set = new Set<string>();
    internalFaltas.forEach((f) => {
      const c = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      if (c) set.add(c);
    });
    const sorted = Array.from(set).sort((a, b) => {
      const idxA = standardComandos.indexOf(a);
      const idxB = standardComandos.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['TODOS', ...sorted];
  }, [internalFaltas]);

  const availableOpms = useMemo(() => {
    let pool = internalFaltas;
    if (selectedCpa !== 'TODOS') {
      pool = pool.filter((f) => normalizeCpaName(f.comandoIntermediario || f.cpa || '') === selectedCpa);
    }
    const set = new Set<string>();
    pool.forEach((f) => {
      const o = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      if (o) set.add(o);
    });
    return ['TODAS', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))];
  }, [internalFaltas, selectedCpa]);

  // Base filtrada rigorosamente por CPA, OPM, Dia e Busca
  const filteredFaltas = useMemo(() => {
    return internalFaltas.filter((f) => {
      const cpaVal = normalizeCpaName(f.comandoIntermediario || f.cpa || '');
      if (selectedCpa !== 'TODOS' && cpaVal !== selectedCpa) return false;

      const opmVal = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      if (selectedOpm !== 'TODAS' && opmVal.toLowerCase() !== selectedOpm.toLowerCase()) return false;

      if (selectedDay !== 'TODOS') {
        const fallbackText = `${f.servicoDia || ''} ${f.turno || ''}`;
        if (!matchesCarimboDate(f.carimbo, selectedDay as any, fallbackText)) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const texto = (f.faltasPoe || f.motivo || '').toLowerCase();
        const oficial = `${f.posto || f.postoGrad || ''} ${f.nomeGuerra || ''} ${f.rg || ''}`.toLowerCase();
        const email = (f.email || '').toLowerCase();
        const carimbo = (f.carimbo || '').toLowerCase();

        return (
          cpaVal.toLowerCase().includes(q) ||
          opmVal.toLowerCase().includes(q) ||
          texto.includes(q) ||
          oficial.includes(q) ||
          email.includes(q) ||
          carimbo.includes(q)
        );
      }

      return true;
    });
  }, [internalFaltas, selectedCpa, selectedOpm, selectedDay, searchTerm]);

  // =========================================================================
  // 1. ESTATÍSTICAS POR CPA (QUANTIDADE DE FALTAS POR COMANDO)
  // =========================================================================
  const { cpaStatsList, totalGeralFaltas, totalGeralEnvios } = useMemo(() => {
    const map: Record<
      string,
      {
        cpa: string;
        envios: number;
        faltas: number;
        opms: Set<string>;
      }
    > = {};

    let totalFaltas = 0;
    let totalEnvios = filteredFaltas.length;

    filteredFaltas.forEach((f) => {
      const cpaName = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
      const opmName = (f.opm || f.uopDestino || f.opmOrigem || '').trim();
      const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);

      totalFaltas += qtd;

      if (!map[cpaName]) {
        map[cpaName] = {
          cpa: cpaName,
          envios: 0,
          faltas: 0,
          opms: new Set(),
        };
      }
      map[cpaName].envios += 1;
      map[cpaName].faltas += qtd;
      if (opmName) map[cpaName].opms.add(opmName);
    });

    const sorted = Object.values(map).sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      const idxA = standardComandos.indexOf(a.cpa);
      const idxB = standardComandos.indexOf(b.cpa);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.cpa.localeCompare(b.cpa);
    });

    return {
      cpaStatsList: sorted,
      totalGeralFaltas: totalFaltas,
      totalGeralEnvios: totalEnvios,
    };
  }, [filteredFaltas]);

  // =========================================================================
  // 2. ESTATÍSTICAS POR OPM (QUANTIDADE DE FALTAS POR OPM)
  // =========================================================================
  const opmStatsList = useMemo(() => {
    const map: Record<
      string,
      {
        opm: string;
        cpa: string;
        envios: number;
        faltas: number;
      }
    > = {};

    filteredFaltas.forEach((f) => {
      const cpaName = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
      const opmName = (f.opm || f.uopDestino || f.opmOrigem || 'Não informada').trim();
      const qtd = countPoliciaisInText(f.faltasPoe || f.motivo);

      if (!map[opmName]) {
        map[opmName] = {
          opm: opmName,
          cpa: cpaName,
          envios: 0,
          faltas: 0,
        };
      }
      map[opmName].envios += 1;
      map[opmName].faltas += qtd;
      if (cpaName && (!map[opmName].cpa || map[opmName].cpa === '1º CPA')) {
        map[opmName].cpa = cpaName;
      }
    });

    return Object.values(map).sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      return a.opm.localeCompare(b.opm, 'pt-BR', { numeric: true });
    });
  }, [filteredFaltas]);

  // =========================================================================
  // 3. RELAÇÃO ANALÍTICA ORDENADA POR OPM
  // =========================================================================
  const sortedAnalitica = useMemo(() => {
    return [...filteredFaltas].sort((a, b) => {
      const opmA = (a.opm || a.uopDestino || a.opmOrigem || '').trim();
      const opmB = (b.opm || b.uopDestino || b.opmOrigem || '').trim();
      const cmp = opmA.localeCompare(opmB, 'pt-BR', { numeric: true });
      if (cmp !== 0) return cmp;
      return (a.carimbo || '').localeCompare(b.carimbo || '');
    });
  }, [filteredFaltas]);

  const totalPages = Math.ceil(sortedAnalitica.length / itemsPerPage) || 1;
  const paginatedAnalitica = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAnalitica.slice(start, start + itemsPerPage);
  }, [sortedAnalitica, currentPage]);

  // Exportar Relatório Oficial PDF
  const handleExportPdf = () => {
    exportVerificacaoPdf(internalFaltas, {
      cpa: selectedCpa,
      opm: selectedOpm,
      dia: selectedDay,
      search: searchTerm,
    });
  };

  // Salvar ou atualizar URL da planilha de verificação
  const handleSaveCustomUrl = async () => {
    if (!customUrl.trim()) {
      // Restaura dados depurados padrões
      CsvHelper.setVerificacaoSheetUrl('');
      const defaultData = parseFaltasCsv(RAW_VERIFICACAO_CSV);
      setInternalFaltas(defaultData);
      CsvHelper.saveVerificacao(defaultData);
      if (onUpdateFaltas) onUpdateFaltas(defaultData);
      setUrlStatus({ loading: false, message: 'Restaurada a base depurada oficial embutida com sucesso!' });
      setTimeout(() => {
        setIsUrlModalOpen(false);
        setUrlStatus(null);
      }, 1500);
      return;
    }

    if (customUrl.includes('docs.google.com/forms/')) {
      setUrlStatus({
        loading: false,
        message: 'Atenção: Este é o link do FORMULÁRIO (Google Forms). Para conectar, abra seu formulário no Google, clique na aba "Respostas", clique no ícone verde "Vincular ao Planilhas" e cole aqui o link da planilha gerada.',
        error: true,
      });
      return;
    }

    setUrlStatus({ loading: true, message: 'Conectando e baixando dados da planilha do Google...' });
    try {
      const csv = await fetchCsvWithTimeout(customUrl.trim(), 14000);
      const parsed = parseFaltasCsv(csv);
      if (parsed.length > 0) {
        setInternalFaltas(parsed);
        CsvHelper.setVerificacaoSheetUrl(customUrl.trim());
        CsvHelper.setFaltasSheetUrl(customUrl.trim());
        CsvHelper.saveVerificacao(parsed);
        CsvHelper.saveFaltas(parsed);
        if (onUpdateFaltas) onUpdateFaltas(parsed);
        setUrlStatus({
          loading: false,
          message: `Conexão bem-sucedida! ${parsed.length} registro(s) carregado(s) e sincronizado(s) com a Aba de Faltas.`,
        });
        setTimeout(() => {
          setIsUrlModalOpen(false);
          setUrlStatus(null);
        }, 1500);
      } else {
        setUrlStatus({ loading: false, message: 'Planilha acessada, porém nenhum registro de falta foi identificado nas colunas.', error: true });
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      let friendlyMsg = 'Verifique se o link foi compartilhado no Google Sheets ou publicado na web.';
      if (errMsg.includes('RESTRICTED') || errMsg.includes('Restrito')) {
        friendlyMsg = 'Acesso restrito no Google Drive. Na planilha do Google, clique no botão azul "Compartilhar" (topo direito), mude o Acesso Geral para "Qualquer pessoa com o link" (Leitor) e salve novamente.';
      } else if (errMsg.includes('404')) {
        friendlyMsg = 'Planilha não encontrada (Erro 404). Verifique se o endereço foi copiado corretamente.';
      }
      setUrlStatus({
        loading: false,
        message: `Falha ao conectar: ${friendlyMsg}`,
        error: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. CABEÇALHO COM TÍTULO, LINK DA PLANILHA E EXPORTAÇÃO */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                    Verificação de Faltas • Base Depurada
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Dados Sem Duplicidade
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Apuração Consolidada de Quantidades de Faltas por Comando Intermediário (CPA) e por OPM
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão de Link Específico desta aba */}
            <button
              onClick={() => setIsUrlModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
              title="Configurar ou verificar o link desta planilha de verificação"
            >
              <Link className="w-3.5 h-3.5 text-slate-600" />
              <span>Link da Planilha</span>
            </button>

            {/* Recarregar */}
            <button
              onClick={() => {
                if (customUrl && customUrl.startsWith('http')) {
                  handleSaveCustomUrl();
                } else {
                  const defaultData = parseFaltasCsv(RAW_VERIFICACAO_CSV);
                  setInternalFaltas(defaultData);
                  CsvHelper.saveVerificacao(defaultData);
                }
              }}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              title="Recarregar base depurada"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recarregar</span>
            </button>

            {/* Exportar PDF Personalizado */}
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Gerar Relatório de Faltas Depuradas em PDF com tabelas por CPA, OPM e Relação Analítica"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar Relatório PDF ({totalGeralFaltas} faltas)</span>
            </button>
          </div>
        </div>

        {/* BARRA EMBUTIDA DE LINK DA PLANILHA DEPURADA (EXCLUSIVA DESTA ABA E APENAS VISÍVEL PARA ADMIN) */}
        {isAdmin && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 bg-slate-50/80 -mx-4 -mb-4 p-3.5 rounded-b-xl border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Link da Nova Planilha (Dados Depurados Sem Duplicidades):
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  (Exclusivo para esta aba de verificação • Acesso Restrito Admin)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {customUrl ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Planilha Remota Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Base Depurada Embutida Ativa (82 envios)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Cole aqui o link do Google Sheets da nova planilha depurada (ex: https://docs.google.com/spreadsheets/d/...)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                />
                {customUrl && (
                  <button
                    onClick={() => setCustomUrl('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Limpar campo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleSaveCustomUrl}
                  disabled={urlStatus?.loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {urlStatus?.loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Salvar e Carregar</span>
                    </>
                  )}
                </button>

                {customUrl && (
                  <button
                    onClick={() => {
                      setCustomUrl('');
                      CsvHelper.setVerificacaoSheetUrl('');
                      const defaultData = parseFaltasCsv(RAW_VERIFICACAO_CSV);
                      setInternalFaltas(defaultData);
                      CsvHelper.saveVerificacao(defaultData);
                      if (onUpdateFaltas) onUpdateFaltas(defaultData);
                      setUrlStatus({ loading: false, message: 'Restaurada a base depurada oficial embutida com sucesso!' });
                      setTimeout(() => setUrlStatus(null), 3000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
                    title="Restaurar base padrão embutida"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </div>
            </div>

            {urlStatus && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  urlStatus.error
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                <span>{urlStatus.message}</span>
                <button
                  onClick={() => setUrlStatus(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* CARDS DE RESUMO EXECUTIVO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3 border-t border-slate-100">
          <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Total de Faltas</span>
            <div className="text-2xl font-black text-rose-900 mt-0.5 font-mono">
              {totalGeralFaltas}
            </div>
            <span className="text-[10px] text-rose-700 font-medium">policiais faltosos no estado</span>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-blue-700 block">Comandos (CPAs)</span>
            <div className="text-2xl font-black text-blue-900 mt-0.5 font-mono">
              {cpaStatsList.length}
            </div>
            <span className="text-[10px] text-blue-700 font-medium">com registros de faltas</span>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-indigo-700 block">OPMs com Faltas</span>
            <div className="text-2xl font-black text-indigo-900 mt-0.5 font-mono">
              {opmStatsList.length}
            </div>
            <span className="text-[10px] text-indigo-700 font-medium">batalhões e unidades</span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Base Depurada</span>
            <div className="text-2xl font-black text-emerald-900 mt-0.5 font-mono">
              {internalFaltas.length}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">registros sem duplicidade</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS: FILTROS E BUSCA */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Seletor CPA */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              Comando (CPA)
            </label>
            <select
              value={selectedCpa}
              onChange={(e) => {
                setSelectedCpa(e.target.value);
                setSelectedOpm('TODAS');
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="TODOS">Todos os Comandos</option>
              {availableCpas.filter((c) => c !== 'TODOS').map((cpa) => (
                <option key={cpa} value={cpa}>
                  {cpa}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor OPM */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              OPM / Batalhão
            </label>
            <select
              value={selectedOpm}
              onChange={(e) => {
                setSelectedOpm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="TODAS">Todas as OPMs</option>
              {availableOpms.filter((o) => o !== 'TODAS').map((opm) => (
                <option key={opm} value={opm}>
                  {opm}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Data */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              Data do Serviço
            </label>
            <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-300">
              <button
                onClick={() => {
                  setSelectedDay('TODOS');
                  setCurrentPage(1);
                }}
                className={`flex-1 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  selectedDay === 'TODOS' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
                title="Todos os Dias do 2º Turno (24 e 25 de Outubro)"
              >
                Todos (24 e 25/OUT)
              </button>
              <button
                onClick={() => {
                  setSelectedDay('24OUT');
                  setCurrentPage(1);
                }}
                className={`flex-1 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  selectedDay === '24OUT' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                24OUT (Sáb)
              </button>
              <button
                onClick={() => {
                  setSelectedDay('25OUT');
                  setCurrentPage(1);
                }}
                className={`flex-1 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  selectedDay === '25OUT' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                25OUT (Dom)
              </button>
            </div>
          </div>

          {/* Campo de Busca */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              Busca Textual
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ex: Barbosa, Goulart, 20º BPM, RG..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Alternador de Modo de Visualização */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Visualização:</span>
            <button
              onClick={() => setViewMode('COMPLETO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'COMPLETO'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Visão Completa
            </button>
            <button
              onClick={() => setViewMode('CONSOLIDADO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'CONSOLIDADO'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Quadros por CPA e OPM
            </button>
            <button
              onClick={() => setViewMode('ANALITICO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'ANALITICO'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Relação Analítica ({sortedAnalitica.length})
            </button>
          </div>

          {(selectedCpa !== 'TODOS' || selectedOpm !== 'TODAS' || selectedDay !== 'TODOS' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCpa('TODOS');
                setSelectedOpm('TODAS');
                setSelectedDay('TODOS');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* 3. QUADROS CONSOLIDADOS: TABELA CPA E TABELA OPM (LADO A LADO EM TELAS GRANDES) */}
      {(viewMode === 'COMPLETO' || viewMode === 'CONSOLIDADO') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* TABELA 1: FALTAS POR CPA */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase text-slate-800">
                  1. Quadro Resumo de Faltas por CPA
                </h3>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                {totalGeralFaltas} faltas
              </span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3">Comando Intermediário (CPA)</th>
                    <th className="py-2.5 px-3 text-center w-36">Quantidade de Faltas</th>
                    <th className="py-2.5 px-3">OPMs com Registro de Faltas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cpaStatsList.length > 0 ? (
                    cpaStatsList.map((item) => {
                      const isSelected = selectedCpa === item.cpa;

                      return (
                        <tr
                          key={item.cpa}
                          onClick={() => {
                            setSelectedCpa(isSelected ? 'TODOS' : item.cpa);
                            setSelectedOpm('TODAS');
                            setCurrentPage(1);
                          }}
                          className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50 ring-1 ring-blue-400' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.cpa}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded font-black text-rose-800 bg-rose-100 border border-rose-200 font-mono text-xs">
                              {item.faltas} falta(s)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {Array.from(item.opms).join(', ') || '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        Nenhum comando com registros para o filtro ativo.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-xs border-t border-slate-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">TOTAL GERAL</td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-300">
                      {totalGeralFaltas} falta(s)
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-300">
                      {opmStatsList.length} OPMs registradas
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* TABELA 2: FALTAS POR OPM */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase text-slate-800">
                  2. Quadro Resumo de Faltas por OPM
                </h3>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {opmStatsList.length} OPMs
              </span>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3">OPM / Unidade Policial</th>
                    <th className="py-2.5 px-3">Comando (CPA)</th>
                    <th className="py-2.5 px-3 text-center w-36">Quantidade de Faltas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opmStatsList.length > 0 ? (
                    opmStatsList.map((item) => {
                      const isSelected = selectedOpm === item.opm;

                      return (
                        <tr
                          key={item.opm}
                          onClick={() => {
                            setSelectedOpm(isSelected ? 'TODAS' : item.opm);
                            setCurrentPage(1);
                          }}
                          className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50 ring-1 ring-blue-400' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900">{item.opm}</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 font-medium">
                            {item.cpa}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded font-black text-rose-800 bg-rose-100 border border-rose-200 font-mono text-xs">
                              {item.faltas} falta(s)
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        Nenhuma OPM encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-slate-900 text-white font-bold text-xs border-t border-slate-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">TOTAL GERAL</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-300">
                      {cpaStatsList.length} CPA(s)
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-300">
                      {totalGeralFaltas} falta(s)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TABELA ANALÍTICA DETALHADA DOS ENVIOS */}
      {(viewMode === 'COMPLETO' || viewMode === 'ANALITICO') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold uppercase text-slate-800">
                3. Relação Analítica Detalhada dos Envios Depurados ({sortedAnalitica.length} registros)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Clique na linha para visualizar o envio completo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-36">OPM / Comando</th>
                  <th className="py-2.5 px-3 w-32 text-center">Data / Hora Envio</th>
                  <th className="py-2.5 px-3 w-48">Oficial que Enviou</th>
                  <th className="py-2.5 px-3 w-44">Endereço de E-mail</th>
                  <th className="py-2.5 px-3 min-w-[280px]">
                    Faltas no POE - Identificação do Policial Faltoso
                  </th>
                  <th className="py-2.5 px-3 w-28 text-center">Qtd Faltas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAnalitica.length > 0 ? (
                  paginatedAnalitica.map((f, index) => {
                    const cpa = normalizeCpaName(f.comandoIntermediario || f.cpa || '1º CPA');
                    const opm = (f.opm || f.uopDestino || f.opmOrigem || 'OPM').trim();
                    const posto = f.posto || f.postoGrad || '';
                    const nome = f.nomeGuerra || '';
                    const rg = f.rg ? `(RG ${f.rg.replace(/[^0-9]/g, '')})` : '';
                    const oficial = `${posto} ${nome} ${rg}`.trim() || 'Oficial';
                    const email = f.email || 'Não informado';
                    const texto = (f.faltasPoe || f.motivo || 'Sem alteração').trim();
                    const qtd = countPoliciaisInText(texto);
                    const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;

                    return (
                      <tr
                        key={f.id || `env-${globalIdx}`}
                        onClick={() =>
                          setSelectedEnvio({
                            idx: globalIdx,
                            opm,
                            cpa,
                            carimbo: f.carimbo || '-',
                            email,
                            oficial,
                            texto,
                            qtd,
                          })
                        }
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                          {globalIdx}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{opm}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{cpa}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                          {f.carimbo || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {oficial}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px] font-mono truncate max-w-[180px]">
                          {email}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-200/70 max-h-28 overflow-y-auto leading-relaxed">
                            {texto}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded font-black font-mono text-xs border ${
                              qtd > 0
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {qtd} {qtd === 1 ? 'falta' : 'faltas'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum envio encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t border-slate-300">
                  <td className="py-2.5 px-3 text-center font-mono">-</td>
                  <td className="py-2.5 px-3 uppercase tracking-wider">
                    {opmStatsList.length} OPMs
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">-</td>
                  <td className="py-2.5 px-3 font-mono">-</td>
                  <td className="py-2.5 px-3 font-mono">-</td>
                  <td className="py-2.5 px-3 uppercase tracking-wider text-slate-300">
                    TOTAL GERAL DE POLICIAIS FALTOSOS
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-300 text-sm">
                    {totalGeralFaltas} falta(s)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Página <strong>{currentPage}</strong> de {totalPages} ({sortedAnalitica.length} envios)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. MODAL PARA CONFIGURAR/VISUALIZAR O LINK DA PLANILHA ESPECÍFICA */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-blue-700" />
                <h3 className="text-sm font-black uppercase text-slate-900">
                  Link da Planilha de Verificação
                </h3>
              </div>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Este link é exclusivo para a <strong>tela de Verificação de Faltas</strong>. A aba
              principal de Faltas permanece vinculada ao seu link original.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                URL da Planilha Depurada (Google Sheets CSV):
              </label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Deixe em branco para utilizar a base depurada embutida no sistema.
              </span>
            </div>

            {urlStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold ${
                  urlStatus.error
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {urlStatus.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                onClick={() => {
                  setCustomUrl('');
                  handleSaveCustomUrl();
                }}
                className="text-xs text-slate-600 hover:underline cursor-pointer"
              >
                Restaurar Base Padrão
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUrlModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCustomUrl}
                  disabled={urlStatus?.loading}
                  className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {urlStatus?.loading ? 'Conectando...' : 'Salvar e Carregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE DETALHES DE UM ENVIO INDIVIDUAL */}
      {selectedEnvio && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white rounded-t-xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase">
                  Detalhes do Envio #{selectedEnvio.idx} — {selectedEnvio.opm}
                </h3>
                <span className="text-[10px] text-slate-300 font-mono">
                  {selectedEnvio.cpa} • {selectedEnvio.carimbo}
                </span>
              </div>
              <button
                onClick={() => setSelectedEnvio(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Oficial Informante:</span>
                  <span className="font-bold text-slate-800">{selectedEnvio.oficial}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">E-mail:</span>
                  <span className="font-mono text-slate-700">{selectedEnvio.email}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Texto Informado no Formulário POE:
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 font-mono">
                    {selectedEnvio.qtd} falta(s)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] whitespace-pre-wrap text-slate-800 leading-relaxed max-h-60 overflow-y-auto">
                  {selectedEnvio.texto}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
              <span className="text-[10px] text-slate-500">EMG-PM/3 • Operação Eleições 2026</span>
              <button
                onClick={() => setSelectedEnvio(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
