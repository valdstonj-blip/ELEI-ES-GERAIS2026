import React, { useState, useMemo } from 'react';
import {
  Search,
  FileDown,
  Building,
  X,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  StopCircle,
  Truck,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  RefreshCw,
  ChevronDown,
  Upload,
  CalendarCheck,
  CheckSquare,
  FileSpreadsheet,
  Zap,
  Calendar,
  FileText,
} from 'lucide-react';
import { LocalVotacao } from '../types';
import { exportLocaisPdf } from '../services/pdfService';
import { isSim, parseLocaisCsv } from '../services/sheetService';
import { enrichLocaisWithDuplicates } from '../services/duplicateService';

interface LocaisTabProps {
  locais: LocalVotacao[];
  onUpdateLocais?: (updated: LocalVotacao[]) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export type LocaisStatusFilter =
  | 'TODOS'
  | 'SABADO_TODOS'
  | 'SABADO_IMPLANTADAS'
  | 'SABADO_PENDENTES'
  | 'DOMINGO_TODOS'
  | 'DOMINGO_IMPLANTADAS'
  | 'DOMINGO_PENDENTES'
  | 'IMPLANTADAS'
  | 'NAO_IMPLANTADAS'
  | 'DESMOBILIZADAS'
  | 'NAO_DESMOBILIZADAS'
  | 'SENSIVEIS'
  | 'DOMINGO'
  | 'BLINDADO'
  | 'ALTERACOES'
  | 'ENERGIA_CABOS'
  | 'ALT_2TURNO';

export const LocaisTab: React.FC<LocaisTabProps> = ({
  locais,
  onUpdateLocais,
  onSync,
  isSyncing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCpa, setSelectedCpa] = useState('TODOS');
  const [selectedUop, setSelectedUop] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState<LocaisStatusFilter>('TODOS');

  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocal, setSelectedLocal] = useState<LocalVotacao | null>(null);

  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);

  // Normalização e associação de linhas
  const { locaisEnriched } = useMemo(() => {
    return enrichLocaisWithDuplicates(locais);
  }, [locais]);

  // Normalização padronizada do CPA (1º CPA, 2º CPA, ..., 8º CPA, CPP)
  const normalizeCpaName = (raw: string): string => {
    if (!raw) return '1º CPA';
    const upper = raw.trim().toUpperCase();
    if (upper.includes('CPP')) return 'CPP';
    const match = upper.match(/([1-8])/);
    if (match) return `${match[1]}º CPA`;
    return raw.trim();
  };

  // Lista de CPAs: 1º CPA, 2º CPA, ..., 8º CPA, CPP
  const availableCpas = useMemo(() => {
    const set = new Set<string>();
    locaisEnriched.forEach((l) => {
      if (l.cpa) set.add(normalizeCpaName(l.cpa));
    });
    const order = ['1º CPA', '2º CPA', '3º CPA', '4º CPA', '5º CPA', '6º CPA', '7º CPA', '8º CPA', 'CPP'];
    const sorted = Array.from(set).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.localeCompare(b);
    });
    return ['TODOS', ...sorted];
  }, [locaisEnriched]);

  // Lista de UOPs em cascata pelo CPA selecionado
  const availableUops = useMemo(() => {
    let pool = locaisEnriched;
    if (selectedCpa !== 'TODOS') {
      pool = locaisEnriched.filter((l) => normalizeCpaName(l.cpa) === selectedCpa);
    }
    const set = new Set(pool.map((l) => (l.uop || '').trim()).filter(Boolean));
    return ['TODAS', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [locaisEnriched, selectedCpa]);

  // Base filtrada rigorosamente por CPA e UOP
  const baseLocais = useMemo(() => {
    return locaisEnriched.filter((l) => {
      if (selectedCpa !== 'TODOS' && normalizeCpaName(l.cpa) !== selectedCpa) return false;
      if (selectedUop !== 'TODAS' && (l.uop || '').trim() !== selectedUop) return false;
      return true;
    });
  }, [locaisEnriched, selectedCpa, selectedUop]);


  // Indicadores diretos que respondem às perguntas solicitadas
  const totalLocais = baseLocais.length;
  const totalSensiveis = useMemo(() => baseLocais.filter((l) => isSim(l.areaSensivel)).length, [baseLocais]);
  const totalDomingo = useMemo(() => baseLocais.filter((l) => isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo)).length, [baseLocais]);
  const totalBlindado = useMemo(() => baseLocais.filter((l) => isSim(l.blindado) || isSim(l.utilizacaoBlindado)).length, [baseLocais]);
  const totalEfSab = useMemo(() => baseLocais.reduce((acc, l) => acc + (Number(l.efetivoSabado) || 0), 0), [baseLocais]);
  const totalEfDom = useMemo(() => baseLocais.reduce((acc, l) => acc + (Number(l.efetivoDomingo) || 0), 0), [baseLocais]);
  const totalAptos = useMemo(() => baseLocais.reduce((acc, l) => acc + (Number(l.qtdAptos || l.totalEleitoresAptos) || 0), 0), [baseLocais]);

  // Contagem de UOPs que indicaram SIM para blindado
  const uopsComBlindadoCount = useMemo(() => {
    const set = new Set<string>();
    baseLocais.forEach((l) => {
      if (l.blindado || l.utilizacaoBlindado) {
        if (l.uop) set.add(l.uop.trim());
      }
    });
    return set.size;
  }, [baseLocais]);

  // Verificação de observações ou alterações válidas
  const hasObservacao = (l: LocalVotacao): boolean => {
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

  const totalComObservacoes = useMemo(() => {
    return baseLocais.filter(hasObservacao).length;
  }, [baseLocais]);

  const totalComAlteracaoEnergia = useMemo(() => {
    return baseLocais.filter((l) => Boolean(l.hasAlteracaoEnergia)).length;
  }, [baseLocais]);

  const totalAlteracoes2Turno = useMemo(() => {
    return baseLocais.filter((l) => Boolean(l.hasAlteracoes2Turno)).length;
  }, [baseLocais]);

  // 1. Acompanhamento Operacional de SÁBADO (24/OUT - Véspera / Implantação sem necessidade no domingo)
  const locaisSabado = useMemo(() => {
    return baseLocais.filter((l) => !(isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo)));
  }, [baseLocais]);
  const sabadoTotal = locaisSabado.length;
  const sabadoImplantadas = useMemo(() => locaisSabado.filter((l) => isSim(l.implantada)).length, [locaisSabado]);
  const sabadoPendentes = sabadoTotal - sabadoImplantadas;
  const sabadoPct = sabadoTotal > 0 ? ((sabadoImplantadas / sabadoTotal) * 100).toFixed(1) : '0.0';

  // 2. Acompanhamento Operacional de DOMINGO (25/OUT - Pleito 2º Turno / Com necessidade no domingo)
  const locaisDomingo = useMemo(() => {
    return baseLocais.filter((l) => isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo));
  }, [baseLocais]);
  const domingoTotal = locaisDomingo.length;
  const domingoImplantadas = useMemo(() => locaisDomingo.filter((l) => isSim(l.implantada)).length, [locaisDomingo]);
  const domingoPendentes = domingoTotal - domingoImplantadas;
  const domingoPct = domingoTotal > 0 ? ((domingoImplantadas / domingoTotal) * 100).toFixed(1) : '0.0';

  // 3. Acompanhamento Geral Consolidado (Implantação e Desmobilização)
  const totalImplantadas = useMemo(() => baseLocais.filter((l) => isSim(l.implantada)).length, [baseLocais]);
  const totalNaoImplantadas = totalLocais - totalImplantadas;
  const totalDesmobilizadas = useMemo(() => baseLocais.filter((l) => isSim(l.desmobilizada)).length, [baseLocais]);
  const totalNaoDesmobilizadas = totalLocais - totalDesmobilizadas;

  const pctImplantadas = totalLocais > 0 ? ((totalImplantadas / totalLocais) * 100).toFixed(1) : '0.0';
  const pctNaoImplantadas = totalLocais > 0 ? ((totalNaoImplantadas / totalLocais) * 100).toFixed(1) : '0.0';
  const pctDesmobilizadas = totalLocais > 0 ? ((totalDesmobilizadas / totalLocais) * 100).toFixed(1) : '0.0';
  const pctNaoDesmobilizadas = totalLocais > 0 ? ((totalNaoDesmobilizadas / totalLocais) * 100).toFixed(1) : '0.0';

  // Distribuição rápida por CPA
  const cpaDistribution = useMemo(() => {
    const map: Record<string, { locais: number; sensiveis: number; blindados: number; domingo: number; imp: number; desmob: number }> = {};
    locaisEnriched.forEach((l) => {
      const c = normalizeCpaName(l.cpa);
      if (!map[c]) {
        map[c] = { locais: 0, sensiveis: 0, blindados: 0, domingo: 0, imp: 0, desmob: 0 };
      }
      map[c].locais++;
      if (isSim(l.areaSensivel)) map[c].sensiveis++;
      if (isSim(l.blindado) || isSim(l.utilizacaoBlindado)) map[c].blindados++;
      if (isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo)) map[c].domingo++;
      if (isSim(l.implantada)) map[c].imp++;
      if (isSim(l.desmobilizada)) map[c].desmob++;
    });
    return map;
  }, [locaisEnriched]);

  // Dataset final para a tabela
  const filteredLocais = useMemo(() => {
    return baseLocais.filter((l) => {
      const hasDomingoImp = isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo);
      const isImp = isSim(l.implantada);
      const isDesm = isSim(l.desmobilizada);

      if (statusFilter === 'SABADO_TODOS' && hasDomingoImp) return false;
      if (statusFilter === 'SABADO_IMPLANTADAS' && (hasDomingoImp || !isImp)) return false;
      if (statusFilter === 'SABADO_PENDENTES' && (hasDomingoImp || isImp)) return false;

      if (statusFilter === 'DOMINGO_TODOS' && !hasDomingoImp) return false;
      if (statusFilter === 'DOMINGO_IMPLANTADAS' && (!hasDomingoImp || !isImp)) return false;
      if (statusFilter === 'DOMINGO_PENDENTES' && (!hasDomingoImp || isImp)) return false;

      if (statusFilter === 'IMPLANTADAS' && !isImp) return false;
      if (statusFilter === 'NAO_IMPLANTADAS' && isImp) return false;
      if (statusFilter === 'DESMOBILIZADAS' && !isDesm) return false;
      if (statusFilter === 'NAO_DESMOBILIZADAS' && isDesm) return false;
      if (statusFilter === 'SENSIVEIS' && !isSim(l.areaSensivel)) return false;
      if (statusFilter === 'DOMINGO' && !hasDomingoImp) return false;
      if (statusFilter === 'BLINDADO' && !(isSim(l.blindado) || isSim(l.utilizacaoBlindado))) return false;
      if (statusFilter === 'ALTERACOES' && !hasObservacao(l)) return false;
      if (statusFilter === 'ENERGIA_CABOS' && !l.hasAlteracaoEnergia) return false;
      if (statusFilter === 'ALT_2TURNO' && !l.hasAlteracoes2Turno) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const nome = (l.nomeLocal || l.local || '').toLowerCase();
        const endereco = (l.endereco || '').toLowerCase();
        const bairro = (l.bairro || '').toLowerCase();
        const uop = (l.uop || '').toLowerCase();
        const cpa = (l.cpa || '').toLowerCase();
        const zona = String(l.numZona || l.zonaEleitoral || '');
        const obs = (l.observacoes || l.observacao || '').toLowerCase();
        const altEnergia = (l.alteracaoEnergia || '').toLowerCase();
        const alt2Turno = (l.alteracoes2Turno || '').toLowerCase();
        if (
          !nome.includes(q) &&
          !endereco.includes(q) &&
          !bairro.includes(q) &&
          !uop.includes(q) &&
          !cpa.includes(q) &&
          !zona.includes(q) &&
          !obs.includes(q) &&
          !altEnergia.includes(q) &&
          !alt2Turno.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [baseLocais, statusFilter, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredLocais.length / itemsPerPage) || 1;
  const paginatedLocais = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLocais.slice(start, start + itemsPerPage);
  }, [filteredLocais, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div id="locais-votacao-dashboard" className="space-y-4">
      {/* BANNER OFICIAL: ELEIÇÕES 2026 - 2º TURNO */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-900/60 rounded-xl p-3 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 shrink-0">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                2º Turno Oficial
              </span>
              <span className="text-xs font-bold text-slate-300">
                Operação Eleições 2026 • EMG-PM/3
              </span>
            </div>
            <h2 className="text-sm md:text-base font-black tracking-tight text-white mt-0.5">
              CRONOGRAMA DO 2º TURNO: 24 (SÁBADO) E 25 (DOMINGO) DE OUTUBRO
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span><strong>24/OUT (SÁB):</strong> Implantação de Urnas</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-700/60 text-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span><strong>25/OUT (DOM):</strong> Pleito Eleitoral</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span><strong>25/OUT (DOM):</strong> Desmobilização Geral</span>
          </div>
        </div>
      </div>

      {/* 1. INDICADORES CLAROS E MODERNOS (RESPONDENDO ÀS PERGUNTAS OPERACIONAIS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Card 1: Locais de Votação */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider">Locais de Votação</span>
            <Building className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 tracking-tight block">
              {totalLocais.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] font-medium text-slate-500 block truncate">
              {selectedCpa !== 'TODOS' ? `${selectedCpa} ${selectedUop !== 'TODAS' ? `(${selectedUop})` : ''}` : 'Total Geral'}
            </span>
          </div>
        </div>

        {/* Card 2: Áreas Sensíveis */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'SENSIVEIS' ? 'TODOS' : 'SENSIVEIS')}
          className={`bg-white border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'SENSIVEIS' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-200/90 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Área Sensível</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-rose-700 tracking-tight block">
              {totalSensiveis.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] font-bold text-rose-600 block">
              {totalLocais > 0 ? `${((totalSensiveis / totalLocais) * 100).toFixed(1)}% dos locais` : '0%'}
            </span>
          </div>
        </div>

        {/* Card 3: Urna Domingo */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'DOMINGO' ? 'TODOS' : 'DOMINGO')}
          className={`bg-white border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'DOMINGO' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Urna Domingo</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-amber-700 tracking-tight block">
              {totalDomingo.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] font-bold text-amber-600 block">
              {totalLocais > 0 ? `${((totalDomingo / totalLocais) * 100).toFixed(1)}% domingo` : '0%'}
            </span>
          </div>
        </div>

        {/* Card 4: Utilização de Blindado (Mais simples e direto) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'BLINDADO' ? 'TODOS' : 'BLINDADO')}
          className={`bg-white border rounded-xl p-3 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'BLINDADO' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/90 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Uso de Blindado</span>
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-indigo-700 tracking-tight block">
              {totalBlindado.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] font-bold text-indigo-600 block">
              {uopsComBlindadoCount} UOP(s) com SIM
            </span>
          </div>
        </div>

        {/* Card 5: Efetivo Sugerido */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider">Efetivo Sugerido</span>
            <Users className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs font-bold">
            <div>
              <span className="text-[9px] text-slate-500 block">24OUT (SÁB)</span>
              <span className="text-sm font-black text-blue-800">{totalEfSab.toLocaleString('pt-BR')}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">25OUT (DOM)</span>
              <span className="text-sm font-black text-emerald-800">{totalEfDom.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PAINEL DE ACOMPANHAMENTO: IMPLANTAÇÃO (SÁBADO VS DOMINGO) E DESMOBILIZAÇÃO */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Monitoramento Operacional de Urnas • Implantação e Desmobilização
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
            Clique nos botões dos quadros para filtrar instantaneamente os locais na tabela
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Implantação de SÁBADO */}
          <div className={`bg-white border rounded-xl p-3.5 shadow-xs space-y-2.5 transition-all ${
            statusFilter.startsWith('SABADO') ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-emerald-300'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded bg-emerald-100 text-emerald-800">
                  <PlayCircle className="w-4 h-4 text-emerald-700" />
                </span>
                <div>
                  <span className="text-[9px] font-bold text-emerald-800 uppercase block">24/OUT (Sábado)</span>
                  <h4 className="text-xs font-black text-slate-900">IMPLANTAÇÃO SÁBADO</h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-black font-mono">
                {sabadoPct}%
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Locais sem necessidade no domingo (meta de entrega integral no sábado).
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setStatusFilter(statusFilter === 'SABADO_IMPLANTADAS' ? 'TODOS' : 'SABADO_IMPLANTADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'SABADO_IMPLANTADAS'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'SABADO_IMPLANTADAS' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                  Já Implantadas
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {sabadoImplantadas.toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'SABADO_PENDENTES' ? 'TODOS' : 'SABADO_PENDENTES')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'SABADO_PENDENTES'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-950 border-rose-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'SABADO_PENDENTES' ? 'text-rose-100' : 'text-rose-700'}`}>
                  Pendentes Sáb.
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {sabadoPendentes.toLocaleString('pt-BR')}
                </span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${sabadoPct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Total Sábado: <strong>{sabadoTotal.toLocaleString('pt-BR')}</strong></span>
                <button
                  onClick={() => setStatusFilter(statusFilter === 'SABADO_TODOS' ? 'TODOS' : 'SABADO_TODOS')}
                  className="text-emerald-700 hover:underline font-bold"
                >
                  Ver todos ({sabadoTotal})
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Implantação de DOMINGO */}
          <div className={`bg-white border rounded-xl p-3.5 shadow-xs space-y-2.5 transition-all ${
            statusFilter.startsWith('DOMINGO') ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-amber-300'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded bg-amber-100 text-amber-800">
                  <Clock className="w-4 h-4 text-amber-700" />
                </span>
                <div>
                  <span className="text-[9px] font-bold text-amber-800 uppercase block">25/OUT (Domingo)</span>
                  <h4 className="text-xs font-black text-slate-900">IMPLANTAÇÃO DOMINGO</h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-black font-mono">
                {domingoPct}%
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Locais com necessidade no domingo (áreas sensíveis e segurança na madrugada).
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setStatusFilter(statusFilter === 'DOMINGO_IMPLANTADAS' ? 'TODOS' : 'DOMINGO_IMPLANTADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'DOMINGO_IMPLANTADAS'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'DOMINGO_IMPLANTADAS' ? 'text-amber-100' : 'text-amber-700'}`}>
                  Já Implantadas
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {domingoImplantadas.toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'DOMINGO_PENDENTES' ? 'TODOS' : 'DOMINGO_PENDENTES')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'DOMINGO_PENDENTES'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-950 border-rose-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'DOMINGO_PENDENTES' ? 'text-rose-100' : 'text-rose-700'}`}>
                  Pendentes Dom.
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {domingoPendentes.toLocaleString('pt-BR')}
                </span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${domingoPct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Total Domingo: <strong>{domingoTotal.toLocaleString('pt-BR')}</strong></span>
                <button
                  onClick={() => setStatusFilter(statusFilter === 'DOMINGO_TODOS' ? 'TODOS' : 'DOMINGO_TODOS')}
                  className="text-amber-700 hover:underline font-bold"
                >
                  Ver todos ({domingoTotal})
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Total Geral Acumulado de Urnas */}
          <div className={`bg-white border rounded-xl p-3.5 shadow-xs space-y-2.5 transition-all ${
            statusFilter === 'IMPLANTADAS' || statusFilter === 'NAO_IMPLANTADAS'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
              : 'border-slate-300'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded bg-blue-100 text-blue-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-700" />
                </span>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Consolidado Geral</span>
                  <h4 className="text-xs font-black text-slate-900">TOTAL IMPLANTADO</h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black font-mono">
                {pctImplantadas}%
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Soma total de urnas implantadas no estado (Sábado + Domingo).
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setStatusFilter(statusFilter === 'IMPLANTADAS' ? 'TODOS' : 'IMPLANTADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'IMPLANTADAS'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'IMPLANTADAS' ? 'text-blue-100' : 'text-blue-700'}`}>
                  Total Implantado
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {totalImplantadas.toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'NAO_IMPLANTADAS' ? 'TODOS' : 'NAO_IMPLANTADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'NAO_IMPLANTADAS'
                    ? 'bg-slate-700 text-white border-slate-800 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'NAO_IMPLANTADAS' ? 'text-slate-200' : 'text-slate-600'}`}>
                  Total Pendente
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {totalNaoImplantadas.toLocaleString('pt-BR')}
                </span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pctImplantadas}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Total Geral: <strong>{totalLocais.toLocaleString('pt-BR')}</strong></span>
                <span className="text-slate-500 font-semibold">{totalNaoImplantadas} restantes</span>
              </div>
            </div>
          </div>

          {/* Card 4: Desmobilização */}
          <div className={`bg-white border rounded-xl p-3.5 shadow-xs space-y-2.5 transition-all ${
            statusFilter === 'DESMOBILIZADAS' || statusFilter === 'NAO_DESMOBILIZADAS'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
              : 'border-indigo-300'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded bg-indigo-100 text-indigo-800">
                  <StopCircle className="w-4 h-4 text-indigo-700" />
                </span>
                <div>
                  <span className="text-[9px] font-bold text-indigo-800 uppercase block">25/OUT (DOM) • Término do Pleito</span>
                  <h4 className="text-xs font-black text-slate-900">DESMOBILIZAÇÃO</h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-xs font-black font-mono">
                {pctDesmobilizadas}%
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Recolhimento de urnas e desmobilização dos locais de votação.
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setStatusFilter(statusFilter === 'DESMOBILIZADAS' ? 'TODOS' : 'DESMOBILIZADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'DESMOBILIZADAS'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'DESMOBILIZADAS' ? 'text-indigo-100' : 'text-indigo-700'}`}>
                  Desmobilizados
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {totalDesmobilizadas.toLocaleString('pt-BR')}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'NAO_DESMOBILIZADAS' ? 'TODOS' : 'NAO_DESMOBILIZADAS')}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  statusFilter === 'NAO_DESMOBILIZADAS'
                    ? 'bg-slate-700 text-white border-slate-800 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase block ${statusFilter === 'NAO_DESMOBILIZADAS' ? 'text-slate-200' : 'text-slate-600'}`}>
                  Em Votação / Aguard.
                </span>
                <span className="text-lg font-black font-mono block mt-0.5">
                  {totalNaoDesmobilizadas.toLocaleString('pt-BR')}
                </span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pctDesmobilizadas}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Total: <strong>{totalLocais.toLocaleString('pt-BR')}</strong></span>
                <span className="text-slate-500 font-semibold">{totalNaoDesmobilizadas} pendentes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta Operacional Especial: Locais com Registro de Alteração de Energia Elétrica / Cabos */}
      {totalComAlteracaoEnergia > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 text-amber-50 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Alterações de Energia Elétrica / Cabos: {totalComAlteracaoEnergia} {totalComAlteracaoEnergia === 1 ? 'Local' : 'Locais'} com Registro
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-200 text-amber-900 font-extrabold uppercase">
                  Coluna Oficial
                </span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                Coluna <code className="bg-amber-100/90 px-1 py-0.5 rounded font-mono font-bold text-amber-900">alteração_local_motivo_roubo_furto_cabo_energia</code> monitorada diretamente da planilha.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => {
                setStatusFilter(statusFilter === 'ENERGIA_CABOS' ? 'TODOS' : 'ENERGIA_CABOS');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'ENERGIA_CABOS'
                  ? 'bg-amber-700 text-white shadow-xs ring-2 ring-amber-400'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{statusFilter === 'ENERGIA_CABOS' ? 'Exibir Todos os Locais' : 'Filtrar Locais com Registro'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. QUADRO COMPARATIVO DIRETO POR CPA (1º AO 8º E CPP) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
          Visão por CPA (Clique para filtrar):
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5 text-xs">
          {['1º CPA', '2º CPA', '3º CPA', '4º CPA', '5º CPA', '6º CPA', '7º CPA', '8º CPA', 'CPP'].map((cpaName) => {
            const data = cpaDistribution[cpaName] || { locais: 0, sensiveis: 0, blindados: 0, domingo: 0, imp: 0, desmob: 0 };
            const isSelected = selectedCpa === cpaName;
            return (
              <button
                key={cpaName}
                onClick={() => {
                  setSelectedCpa(isSelected ? 'TODOS' : cpaName);
                  setSelectedUop('TODAS');
                  setCurrentPage(1);
                }}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-blue-50/50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-black text-xs ${isSelected ? 'text-white' : 'text-slate-900'}`}>{cpaName}</span>
                  <span className={`text-[11px] font-extrabold font-mono ${isSelected ? 'text-sky-200' : 'text-blue-700'}`}>
                    {data.locais}
                  </span>
                </div>
                <div className={`mt-1 space-y-0.5 text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                  <div className="flex justify-between">
                    <span>Sensíveis:</span>
                    <strong className={isSelected ? 'text-white' : (data.sensiveis > 0 ? 'text-rose-600' : 'text-slate-400')}>{data.sensiveis}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Blindado:</span>
                    <strong className={isSelected ? 'text-white' : (data.blindados > 0 ? 'text-indigo-600' : 'text-slate-400')}>{data.blindados}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Implant.:</span>
                    <strong className={isSelected ? 'text-emerald-300' : 'text-emerald-700'}>{data.imp}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Desmob.:</span>
                    <strong className={isSelected ? 'text-indigo-200' : 'text-indigo-700'}>{data.desmob}</strong>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. BARRA DE FERRAMENTAS: BUSCA, FILTROS EM CASCATA CPA / UOP E EXPORTAR PDF */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por local de votação, endereço, bairro, UOP ou zona..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
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

          {/* Seletores CPA e UOP em Cascata */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs">
              <span className="text-[11px] font-bold text-slate-600">CPA:</span>
              <select
                value={selectedCpa}
                onChange={(e) => {
                  setSelectedCpa(e.target.value);
                  setSelectedUop('TODAS');
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer"
              >
                {availableCpas.map((cpa) => (
                  <option key={cpa} value={cpa}>
                    {cpa}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs">
              <span className="text-[11px] font-bold text-slate-600">UOP:</span>
              <select
                value={selectedUop}
                onChange={(e) => {
                  setSelectedUop(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                {availableUops.map((uop) => (
                  <option key={uop} value={uop}>
                    {uop}
                  </option>
                ))}
              </select>
            </div>

            {/* Menu Dropdown de Exportação em PDF com Filtros e Tipos de Relatório */}
            <div className="relative inline-block text-left">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => {
                    exportLocaisPdf(locaisEnriched, {
                      cpa: selectedCpa,
                      uop: selectedUop,
                      statusFilter,
                      search: searchTerm,
                      reportType: 'COMPLETO',
                    });
                  }}
                  title={`Baixar PDF de Locais de Votação com os filtros ativos (${selectedUop !== 'TODAS' ? selectedUop : selectedCpa})`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-l-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    {selectedUop !== 'TODAS'
                      ? `Exportar PDF (${selectedUop})`
                      : selectedCpa !== 'TODOS'
                      ? `Exportar PDF (${selectedCpa})`
                      : statusFilter !== 'TODOS'
                      ? `Exportar PDF (${statusFilter})`
                      : 'Exportar PDF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfDropdownOpen((prev) => !prev)}
                  title="Opções de relatório (Completo, Sintético ou Geral do Estado)"
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
                  <div className="origin-top-right absolute right-0 mt-1 w-72 rounded-lg shadow-lg bg-white ring-1 ring-black/5 divide-y divide-slate-100 z-30">
                    <div className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-t-lg">
                      {selectedCpa !== 'TODOS' || selectedUop !== 'TODAS'
                        ? `Filtrado: ${selectedUop !== 'TODAS' ? selectedUop : selectedCpa}`
                        : 'Relatórios dos Locais de Votação:'}
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportLocaisPdf(locaisEnriched, {
                            cpa: selectedCpa,
                            uop: selectedUop,
                            statusFilter,
                            search: searchTerm,
                            reportType: 'COMPLETO',
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-bold cursor-pointer"
                      >
                        <span>PDF — Relatório Completo</span>
                        <span className="text-[10px] text-slate-600 font-normal">Filtros atuais</span>
                      </button>

                      <button
                        onClick={() => {
                          exportLocaisPdf(locaisEnriched, {
                            cpa: selectedCpa,
                            uop: selectedUop,
                            statusFilter,
                            search: searchTerm,
                            reportType: 'SINTETICO',
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold">PDF — Quadro Síntese por Unidade</span>
                        <span className="text-[10px] text-slate-600 font-normal">Executivo</span>
                      </button>

                      <button
                        onClick={() => {
                          exportLocaisPdf(locaisEnriched, {
                            cpa: selectedCpa,
                            uop: selectedUop,
                            statusFilter,
                            search: searchTerm,
                            reportType: 'DETALHADO',
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold">PDF — Listagem Detalhada de Locais</span>
                        <span className="text-[10px] text-slate-600 font-normal">Com endereços</span>
                      </button>
                    </div>

                    <div className="py-1 bg-slate-50/50 rounded-b-lg">
                      <button
                        onClick={() => {
                          exportLocaisPdf(locaisEnriched, {
                            cpa: 'TODOS',
                            uop: 'TODAS',
                            statusFilter: 'TODOS',
                            reportType: 'COMPLETO',
                          });
                          setPdfDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between cursor-pointer font-bold"
                      >
                        <span>PDF — Geral Completo (Todo o Estado)</span>
                        <span className="text-[10px] text-blue-600 font-normal">Sem filtros</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filtros Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 text-xs">
          <button
            onClick={() => {
              setStatusFilter('TODOS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'TODOS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Todos ({totalLocais.toLocaleString('pt-BR')})
          </button>

          <button
            onClick={() => {
              setStatusFilter('IMPLANTADAS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'IMPLANTADAS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            Implantadas ({totalImplantadas})
          </button>

          <button
            onClick={() => {
              setStatusFilter('DESMOBILIZADAS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'DESMOBILIZADAS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            Desmobilizadas ({totalDesmobilizadas})
          </button>

          <button
            onClick={() => {
              setStatusFilter('SENSIVEIS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'SENSIVEIS'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            Sensíveis ({totalSensiveis})
          </button>

          <button
            onClick={() => {
              setStatusFilter('DOMINGO');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'DOMINGO'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            Urna Domingo ({totalDomingo})
          </button>

          <button
            onClick={() => {
              setStatusFilter('BLINDADO');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'BLINDADO'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
            }`}
          >
            Blindado ({totalBlindado})
          </button>

          <button
            onClick={() => {
              setStatusFilter('ALTERACOES');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'ALTERACOES'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Com Alterações ({totalComObservacoes})</span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'ENERGIA_CABOS' ? 'TODOS' : 'ENERGIA_CABOS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'ENERGIA_CABOS'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                : totalComAlteracaoEnergia > 0
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-black shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${totalComAlteracaoEnergia > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-500'}`} />
            <span>Alt. Energia / Cabos ({totalComAlteracaoEnergia})</span>
          </button>

          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'ALT_2TURNO' ? 'TODOS' : 'ALT_2TURNO');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'ALT_2TURNO'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                : totalAlteracoes2Turno > 0
                ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-extrabold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${totalAlteracoes2Turno > 0 ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>Alt. 2º Turno ({totalAlteracoes2Turno})</span>
          </button>
        </div>
      </div>

      {/* 5. TABELA DE DADOS INTEGRAL (EXATAMENTE NA ORDEM DA PLANILHA) COM BARRAS DE ROLAGEM VERTICAL E HORIZONTAL */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
          <table className="w-full text-left text-xs text-slate-700 min-w-[1400px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider shadow-xs">
              <tr>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">LINHA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">NUM_ZONA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">QTD_APTOS</th>
                <th className="py-2.5 px-2 whitespace-nowrap bg-slate-900">NOM_MUNICIPIO</th>
                <th className="py-2.5 px-2 whitespace-nowrap bg-slate-900">NOM_BAIRRO</th>
                <th className="py-2.5 px-3 min-w-[200px] bg-slate-900">ENDERECO_LOCAL</th>
                <th className="py-2.5 px-3 min-w-[220px] bg-slate-900">NOM_LOCAL</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">CPA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">UOP</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">ÁREA SENSIVEL (SIM/NÃO)</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">NECESSIDADE DE IMPLANTAÇÃO DA URNA NO DOMINGO</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-blue-950 text-blue-200" title="Coluna O: Alterações na Votação 2º Turno">
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>ALTERAÇÕES NA VOTAÇÃO 2° TURNO</span>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-900">UTILIZAÇÃO DO BLINDADO PARA IMPLANTAÇÃO DA URNA(SIM/NÃO)</th>
                <th className="py-2.5 px-2 min-w-[150px] bg-slate-900">OBSERVAÇÕS E ALTERAÇÕES</th>
                <th className="py-2.5 px-2 min-w-[180px] bg-amber-950 text-amber-200">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>ALT. ENERGIA / CABOS</span>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-emerald-950 text-emerald-200" title="Sincronizado diretamente da Planilha Oficial">
                  URNA IMPLANTADA
                </th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-blue-950 text-blue-200" title="Sincronizado diretamente da Planilha Oficial">
                  DESMOBILIZAÇÃO.
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedLocais.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400">
                    Nenhum local de votação encontrado com os critérios aplicados.
                  </td>
                </tr>
              ) : (
                paginatedLocais.map((loc, idx) => {
                  const nome = loc.nomeLocal || loc.local;
                  const zona = loc.numZona || loc.zonaEleitoral;
                  const aptos = loc.qtdAptos || loc.totalEleitoresAptos || 0;
                  const isSensivel = loc.areaSensivel;
                  const isDomingo = loc.implantacaoDomingo || loc.necessidadeImplantacaoDomingo;
                  const isBlindado = loc.blindado || loc.utilizacaoBlindado;
                  const hasAlt = hasObservacao(loc);
                  const obsTexto = (loc.observacoes || loc.observacao || '').trim();

                  return (
                    <tr
                      key={loc.id || `loc-${idx}`}
                      onClick={() => setSelectedLocal(loc)}
                      className={`transition-colors cursor-pointer ${
                        hasAlt
                          ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 font-medium'
                          : (idx % 2 === 1 ? 'bg-slate-50/30 hover:bg-slate-50/80' : 'bg-white hover:bg-slate-50/80')
                      }`}
                    >
                      {/* 0. LINHA NA PLANILHA */}
                      <td className="py-2.5 px-2 text-center font-mono text-[10px]">
                        {loc.linhaPlanilha ? (
                          <span
                            className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600"
                            title={`Linha física ${loc.linhaPlanilha} na planilha do Google Sheets`}
                          >
                            L.{loc.linhaPlanilha}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* 1. NUM_ZONA */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900">
                        {zona}
                      </td>

                      {/* 2. QTD_APTOS */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                        {Number(aptos).toLocaleString('pt-BR')}
                      </td>

                      {/* 3. NOM_MUNICIPIO */}
                      <td className="py-2.5 px-2 text-slate-700 whitespace-nowrap font-medium">
                        {loc.municipio || 'RIO DE JANEIRO'}
                      </td>

                      {/* 4. NOM_BAIRRO */}
                      <td className="py-2.5 px-2 text-slate-700 whitespace-nowrap">
                        {loc.bairro || '-'}
                      </td>

                      {/* 5. ENDERECO_LOCAL */}
                      <td className="py-2.5 px-3 text-slate-800">
                        <span className="line-clamp-1" title={loc.endereco}>
                          {loc.endereco || '-'}
                        </span>
                      </td>

                      {/* 6. NOM_LOCAL */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasAlt && (
                              <span
                                title="Local com alterações registradas"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-white uppercase shrink-0 shadow-2xs"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>ALT</span>
                              </span>
                            )}
                            <span className="line-clamp-1" title={nome}>
                              {nome}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 7. CPA */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 whitespace-nowrap">
                        {normalizeCpaName(loc.cpa)}
                      </td>

                      {/* 8. UOP */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900 whitespace-nowrap">
                        {loc.uop}
                      </td>

                      {/* 9. ÁREA SENSIVEL (SIM/NÃO) */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isSensivel
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {isSensivel ? 'SIM' : 'NÃO'}
                        </span>
                      </td>

                      {/* 10. NECESSIDADE DE IMPLANTAÇÃO DA URNA NO DOMINGO */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isDomingo
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {isDomingo ? 'SIM' : 'NÃO'}
                        </span>
                      </td>

                      {/* ALTERAÇÕES NA VOTAÇÃO 2° TURNO (Coluna O da Planilha) */}
                      <td className="py-2.5 px-2 text-[11px] text-center">
                        {loc.hasAlteracoes2Turno ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocal(loc);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-950 font-bold max-w-[280px] shadow-2xs transition-colors cursor-pointer"
                            title="Clique para ler a alteração da votação no 2º turno"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{loc.alteracoes2Turno}</span>
                          </div>
                        ) : loc.alteracoes2Turno ? (
                          <span className="text-slate-600 font-medium text-[11px]">{loc.alteracoes2Turno}</span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
                      </td>

                      {/* 11. UTILIZAÇÃO DO BLINDADO PARA IMPLANTAÇÃO DA URNA(SIM/NÃO) */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isBlindado
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {isBlindado ? 'SIM' : 'NÃO'}
                        </span>
                      </td>

                      {/* 12. OBSERVAÇÕS E ALTERAÇÕES */}
                      <td className="py-2.5 px-2 text-[11px]">
                        {hasAlt ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocal(loc);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold max-w-[280px] shadow-2xs transition-colors cursor-pointer"
                            title="Clique para abrir e ler a alteração completa"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{obsTexto}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 13. ALTERAÇÃO ENERGIA / FURTO DE CABOS */}
                      <td className="py-2.5 px-2 text-[11px]">
                        {loc.hasAlteracaoEnergia ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocal(loc);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold max-w-[280px] shadow-2xs transition-colors cursor-pointer"
                            title="Clique para abrir e ler a alteração de energia/furto de cabos"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                            <span className="truncate">{loc.alteracaoEnergia}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 15. URNA IMPLANTADA (Dado Oficial da Planilha) */}
                      <td
                        className="py-2.5 px-2 text-center"
                        title={isSim(loc.implantada) ? 'Urna Implantada: SIM (Planilha Oficial)' : 'Urna Implantada: NÃO (Planilha Oficial)'}
                      >
                        {isSim(loc.implantada) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs select-none">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            SIM
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 select-none">
                            NÃO
                          </span>
                        )}
                      </td>

                      {/* 16. DESMOBILIZAÇÃO. (Dado Oficial da Planilha) */}
                      <td
                        className="py-2.5 px-2 text-center"
                        title={isSim(loc.desmobilizada) ? 'Desmobilização: SIM (Planilha Oficial)' : 'Desmobilização: NÃO (Planilha Oficial)'}
                      >
                        {isSim(loc.desmobilizada) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs select-none">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            SIM
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 select-none">
                            NÃO
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50/80 border-t border-slate-200/90 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Exibindo</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span>de <strong>{filteredLocais.length.toLocaleString('pt-BR')}</strong> locais</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-bold text-slate-800">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Local de Votação */}
      {selectedLocal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
                  Zona {selectedLocal.numZona || selectedLocal.zonaEleitoral} • {normalizeCpaName(selectedLocal.cpa)} • {selectedLocal.uop}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {selectedLocal.nomeLocal || selectedLocal.local}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLocal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Endereço</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedLocal.endereco}</p>
                <p className="text-slate-500 text-[11px]">{selectedLocal.bairro} - {selectedLocal.municipio}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Eleitorado</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {(selectedLocal.qtdAptos || selectedLocal.totalEleitoresAptos || 0).toLocaleString('pt-BR')} Eleitores Aptos
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Condições Operacionais</span>
                <p className="text-slate-700 mt-0.5">
                  Área Sensível: <strong>{selectedLocal.areaSensivel ? 'SIM' : 'NÃO'}</strong>
                </p>
                <p className="text-slate-700 text-[11px]">
                  Blindado: <strong>{selectedLocal.blindado || selectedLocal.utilizacaoBlindado ? 'SIM' : 'NÃO'}</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block uppercase flex items-center justify-between">
                  <span>Planilha Oficial</span>
                  <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Sincronizado da Planilha</span>
                </span>
                <div className="mt-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Urna Implantada:</span>
                    <strong className={isSim(selectedLocal.implantada) ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                      {isSim(selectedLocal.implantada) ? 'SIM' : 'NÃO'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Desmobilização:</span>
                    <strong className={isSim(selectedLocal.desmobilizada) ? 'text-blue-700 font-black' : 'text-slate-400'}>
                      {isSim(selectedLocal.desmobilizada) ? 'SIM' : 'NÃO'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerta de Alteração de Energia / Furto de Cabos */}
            {selectedLocal.hasAlteracaoEnergia && (
              <div className="p-3.5 bg-amber-50 rounded-xl border-2 border-amber-400 text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-950 font-black uppercase text-[11px]">
                    <Zap className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>Registro de Alteração de Energia Elétrica / Cabos</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                    Coluna Oficial
                  </span>
                </div>
                <div className="p-3 bg-white/95 rounded-lg border border-amber-300 text-amber-950 font-bold text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLocal.alteracaoEnergia}
                </div>
                {selectedLocal.linhaPlanilha && (
                  <p className="text-[10px] text-amber-800 font-semibold">
                    📍 Registro na <strong>Linha {selectedLocal.linhaPlanilha}</strong> da planilha do Google Sheets.
                  </p>
                )}
              </div>
            )}

            {/* Alterações na Votação 2º Turno (Coluna O) */}
            {selectedLocal.alteracoes2Turno && (
              <div className="p-3.5 bg-blue-50 rounded-xl border-2 border-blue-400 text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-950 font-black uppercase text-[11px]">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Alterações na Votação 2° Turno</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-200 text-blue-950 uppercase font-mono">
                    Coluna O
                  </span>
                </div>
                <div className="p-3 bg-white/95 rounded-lg border border-blue-200 text-blue-950 font-bold text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLocal.alteracoes2Turno}
                </div>
                {selectedLocal.linhaPlanilha && (
                  <p className="text-[10px] text-blue-800 font-semibold">
                    📍 Registro na <strong>Linha {selectedLocal.linhaPlanilha}</strong> da planilha do Google Sheets.
                  </p>
                )}
              </div>
            )}

            {hasObservacao(selectedLocal) && (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-900 font-extrabold uppercase text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Observações & Alterações Operacionais</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                    Atenção Eleições
                  </span>
                </div>
                <div className="p-3 bg-white/90 rounded-lg border border-amber-200 text-amber-950 font-bold text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLocal.observacoes || selectedLocal.observacao}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLocal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
