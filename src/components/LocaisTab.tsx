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
} from 'lucide-react';
import { LocalVotacao } from '../types';
import { exportLocaisPdf } from '../services/pdfService';
import { isSim } from '../services/sheetService';

interface LocaisTabProps {
  locais: LocalVotacao[];
  onUpdateLocais?: (updated: LocalVotacao[]) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export const LocaisTab: React.FC<LocaisTabProps> = ({
  locais,
  onUpdateLocais,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCpa, setSelectedCpa] = useState('TODOS');
  const [selectedUop, setSelectedUop] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState<
    | 'TODOS'
    | 'IMPLANTADAS'
    | 'DESMOBILIZADAS'
    | 'SENSIVEIS'
    | 'DOMINGO'
    | 'BLINDADO'
    | 'ALTERACOES'
  >('TODOS');

  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocal, setSelectedLocal] = useState<LocalVotacao | null>(null);

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
    locais.forEach((l) => {
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
  }, [locais]);

  // Lista de UOPs em cascata pelo CPA selecionado
  const availableUops = useMemo(() => {
    let pool = locais;
    if (selectedCpa !== 'TODOS') {
      pool = locais.filter((l) => normalizeCpaName(l.cpa) === selectedCpa);
    }
    const set = new Set(pool.map((l) => (l.uop || '').trim()).filter(Boolean));
    return ['TODAS', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [locais, selectedCpa]);

  // Base filtrada rigorosamente por CPA e UOP
  const baseLocais = useMemo(() => {
    return locais.filter((l) => {
      if (selectedCpa !== 'TODOS' && normalizeCpaName(l.cpa) !== selectedCpa) return false;
      if (selectedUop !== 'TODAS' && (l.uop || '').trim() !== selectedUop) return false;
      return true;
    });
  }, [locais, selectedCpa, selectedUop]);

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

  // Acompanhamento do Evento em tempo real (Implantação e Desmobilização)
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
    locais.forEach((l) => {
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
  }, [locais]);

  // Dataset final para a tabela
  const filteredLocais = useMemo(() => {
    return baseLocais.filter((l) => {
      if (statusFilter === 'IMPLANTADAS' && !isSim(l.implantada)) return false;
      if (statusFilter === 'DESMOBILIZADAS' && !isSim(l.desmobilizada)) return false;
      if (statusFilter === 'SENSIVEIS' && !isSim(l.areaSensivel)) return false;
      if (statusFilter === 'DOMINGO' && !(isSim(l.implantacaoDomingo) || isSim(l.necessidadeImplantacaoDomingo))) return false;
      if (statusFilter === 'BLINDADO' && !(isSim(l.blindado) || isSim(l.utilizacaoBlindado))) return false;
      if (statusFilter === 'ALTERACOES' && !hasObservacao(l)) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const nome = (l.nomeLocal || l.local || '').toLowerCase();
        const endereco = (l.endereco || '').toLowerCase();
        const bairro = (l.bairro || '').toLowerCase();
        const uop = (l.uop || '').toLowerCase();
        const cpa = (l.cpa || '').toLowerCase();
        const zona = String(l.numZona || l.zonaEleitoral || '');
        const obs = (l.observacoes || l.observacao || '').toLowerCase();
        if (
          !nome.includes(q) &&
          !endereco.includes(q) &&
          !bairro.includes(q) &&
          !uop.includes(q) &&
          !cpa.includes(q) &&
          !zona.includes(q) &&
          !obs.includes(q)
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

  // Alternância ágil pelo operador (clique direto na linha)
  const handleToggleImplantada = (local: LocalVotacao, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateLocais) return;
    const next = !isSim(local.implantada);
    const updated = locais.map((l) => (l.id === local.id ? { ...l, implantada: next } : l));
    onUpdateLocais(updated);
  };

  const handleToggleDesmobilizada = (local: LocalVotacao, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateLocais) return;
    const next = !isSim(local.desmobilizada);
    const updated = locais.map((l) => (l.id === local.id ? { ...l, desmobilizada: next } : l));
    onUpdateLocais(updated);
  };

  return (
    <div id="locais-votacao-dashboard" className="space-y-4">
      {/* 1. INDICADORES CLAROS E MODERNOS (RESPONDENDO ÀS PERGUNTAS OPERACIONAIS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
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
              <span className="text-[9px] text-slate-500 block">03OUT (SÁB)</span>
              <span className="text-sm font-black text-blue-800">{totalEfSab.toLocaleString('pt-BR')}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">04OUT (DOM)</span>
              <span className="text-sm font-black text-emerald-800">{totalEfDom.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Card 6: Eleitores Aptos */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider">Eleitores Aptos</span>
            <Users className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 tracking-tight block truncate">
              {totalAptos.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Eleitorado apto
            </span>
          </div>
        </div>
      </div>

      {/* 2. PAINEL DE ACOMPANHAMENTO: IMPLANTAÇÃO E DESMOBILIZAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Painel Implantação de Urnas */}
        <div className="bg-white border border-emerald-300 rounded-xl p-3.5 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-emerald-100 text-emerald-800">
                <PlayCircle className="w-4 h-4 text-emerald-700" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  URNA IMPLANTADA
                </h3>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-black font-mono">
              {pctImplantadas}%
            </span>
          </div>

          <div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'IMPLANTADAS' ? 'TODOS' : 'IMPLANTADAS')}
              className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                statusFilter === 'IMPLANTADAS'
                  ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                  Urnas Implantadas (SIM)
                </span>
                <span className="text-xs font-bold text-emerald-700">({pctImplantadas}%)</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-emerald-900">{totalImplantadas.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-slate-500">de {totalLocais.toLocaleString('pt-BR')} locais</span>
              </div>
            </button>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${pctImplantadas}%` }}
            ></div>
          </div>
        </div>

        {/* Painel Desmobilização */}
        <div className="bg-white border border-blue-300 rounded-xl p-3.5 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-blue-100 text-blue-800">
                <StopCircle className="w-4 h-4 text-blue-700" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  DESMOBILIZAÇÃO
                </h3>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black font-mono">
              {pctDesmobilizadas}%
            </span>
          </div>

          <div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'DESMOBILIZADAS' ? 'TODOS' : 'DESMOBILIZADAS')}
              className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                statusFilter === 'DESMOBILIZADAS'
                  ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500/20'
                  : 'bg-blue-50/50 border-blue-200 hover:bg-blue-100/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 uppercase block">
                  Locais Desmobilizados (SIM)
                </span>
                <span className="text-xs font-bold text-blue-700">({pctDesmobilizadas}%)</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-blue-900">{totalDesmobilizadas.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-slate-500">de {totalLocais.toLocaleString('pt-BR')} locais</span>
              </div>
            </button>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${pctDesmobilizadas}%` }}
            ></div>
          </div>
        </div>
      </div>

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

            {/* Exportar PDF Respeitando Estritamente os Filtros Ativos */}
            <button
              onClick={() => {
                exportLocaisPdf(baseLocais, {
                  cpa: selectedCpa,
                  uop: selectedUop,
                  statusFilter,
                  search: searchTerm,
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
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
        </div>
      </div>

      {/* 5. TABELA DE DADOS INTEGRAL (EXATAMENTE NA ORDEM DA PLANILHA) */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-800 text-white uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">NUM_ZONA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">QTD_APTOS</th>
                <th className="py-2.5 px-2 whitespace-nowrap">NOM_MUNICIPIO</th>
                <th className="py-2.5 px-2 whitespace-nowrap">NOM_BAIRRO</th>
                <th className="py-2.5 px-3 min-w-[200px]">ENDERECO_LOCAL</th>
                <th className="py-2.5 px-3 min-w-[220px]">NOM_LOCAL</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">CPA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">UOP</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">ÁREA SENSIVEL (SIM/NÃO)</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">NECESSIDADE DE IMPLANTAÇÃO DA URNA NO DOMINGO</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">UTILIZAÇÃO DO BLINDADO PARA IMPLANTAÇÃO DA URNA(SIM/NÃO)</th>
                <th className="py-2.5 px-2 min-w-[150px]">OBSERVAÇÕS E ALTERAÇÕES</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-emerald-900/60">URNA IMPLANTADA</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-blue-900/60">DESMOBILIZAÇÃO.</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedLocais.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
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
                        <div className="flex items-center gap-1.5">
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

                      {/* 15. URNA IMPLANTADA */}
                      <td
                        onClick={(e) => handleToggleImplantada(loc, e)}
                        className="py-2.5 px-2 text-center"
                        title="Clique para alternar status de implantação"
                      >
                        {isSim(loc.implantada) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            SIM
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                            NÃO
                          </span>
                        )}
                      </td>

                      {/* 16. DESMOBILIZAÇÃO. */}
                      <td
                        onClick={(e) => handleToggleDesmobilizada(loc, e)}
                        className="py-2.5 px-2 text-center"
                        title="Clique para alternar status de desmobilização"
                      >
                        {isSim(loc.desmobilizada) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            SIM
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
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
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
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
            </div>

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
