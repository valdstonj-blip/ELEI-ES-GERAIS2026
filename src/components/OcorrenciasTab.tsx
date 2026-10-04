import React, { useState, useMemo } from 'react';
import {
  Search,
  FileDown,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileText,
  Clock,
  MapPin,
  ShieldAlert,
  ChevronDown,
  RefreshCw,
  Link2,
  Building2,
  AlertCircle,
  FileSpreadsheet,
  User,
  Mail,
  Shield,
  FileCheck,
} from 'lucide-react';
import { Ocorrencia } from '../types';
import { exportOcorrenciasPdf, matchesCarimboDate } from '../services/pdfService';
import { normalizeCpaName } from '../services/sheetService';

interface OcorrenciasTabProps {
  ocorrencias: Ocorrencia[];
  onAddOcorrencia?: (nova: Ocorrencia) => void;
  lastSyncTime?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  onOpenSettings?: () => void;
}

// As 5 perguntas com respostas pré-definidas em múltipla escolha
const CRIMES_FORMULARIO = [
  {
    id: 'Crimes comuns contra candidatos',
    title: 'Crimes comuns contra candidatos',
    short: 'Contra Candidatos',
    key: 'crimesCandidatos' as const,
    color: 'amber',
    borderColor: 'border-amber-300',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-900',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'Crimes comuns nos locais de votação/apuração',
    title: 'Crimes comuns nos locais de votação/apuração',
    short: 'Locais de Votação',
    key: 'crimesLocaisVotacao' as const,
    color: 'blue',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-900',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    id: 'Crimes Eleitorais',
    title: 'Crimes Eleitorais',
    short: 'Crimes Eleitorais',
    key: 'crimesEleitorais' as const,
    color: 'purple',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-900',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação',
    title:
      'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação',
    short: 'Incidentes Segurança',
    key: 'incidentesSeguranca' as const,
    color: 'sky',
    borderColor: 'border-sky-300',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-900',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'Prisões/apreensões no entorno e/ou locais de votação',
    title: 'Prisões/apreensões no entorno e/ou locais de votação',
    short: 'Prisões / Apreensões',
    key: 'prisoesApreensoes' as const,
    color: 'rose',
    borderColor: 'border-rose-300',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-900',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
];

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

// Retorna todos os crimes assinalados em uma ocorrência (pode haver mais de um no mesmo formulário!)
function getCrimesDaOcorrencia(oc: Ocorrencia): { categoria: string; crime: string; color: string }[] {
  const result: { categoria: string; crime: string; color: string }[] = [];

  if (!isNaoHouve(oc.crimesCandidatos)) {
    result.push({
      categoria: 'Contra Candidatos',
      crime: oc.crimesCandidatos!,
      color: 'bg-amber-50 text-amber-900 border-amber-200',
    });
  }
  if (!isNaoHouve(oc.crimesLocaisVotacao)) {
    result.push({
      categoria: 'Locais de Votação/Apuração',
      crime: oc.crimesLocaisVotacao!,
      color: 'bg-blue-50 text-blue-900 border-blue-200',
    });
  }
  if (!isNaoHouve(oc.crimesEleitorais)) {
    result.push({
      categoria: 'Crimes Eleitorais',
      crime: oc.crimesEleitorais!,
      color: 'bg-purple-50 text-purple-900 border-purple-200',
    });
  }
  if (!isNaoHouve(oc.incidentesSeguranca)) {
    result.push({
      categoria: 'Incidentes Seg. Pública / Entorno',
      crime: oc.incidentesSeguranca!,
      color: 'bg-sky-50 text-sky-900 border-sky-200',
    });
  }
  if (!isNaoHouve(oc.prisoesApreensoes)) {
    result.push({
      categoria: 'Prisões/Apreensões Entorno',
      crime: oc.prisoesApreensoes!,
      color: 'bg-rose-50 text-rose-900 border-rose-200',
    });
  }

  // Se nada foi capturado nas propriedades individuais mas há seHouverOcorrenciaDizerQual
  if (result.length === 0 && oc.seHouverOcorrenciaDizerQual && !isNaoHouve(oc.seHouverOcorrenciaDizerQual)) {
    result.push({
      categoria: 'Ocorrência Registrada',
      crime: oc.seHouverOcorrenciaDizerQual,
      color: 'bg-rose-50 text-rose-900 border-rose-200',
    });
  }

  return result;
}

export const OcorrenciasTab: React.FC<OcorrenciasTabProps> = ({
  ocorrencias,
  lastSyncTime,
  onSync,
  isSyncing,
  onOpenSettings,
}) => {
  // Filtro estrito de dias pelo Carimbo de Data/Hora (03OUT26 ou 04OUT26)
  const [selectedDay, setSelectedDay] = useState<'TODOS' | '03OUT' | '04OUT'>('TODOS');
  const [selectedCrimeFilter, setSelectedCrimeFilter] = useState<string>('TODOS');
  const [selectedCpa, setSelectedCpa] = useState<string>('TODOS');
  const [selectedOpm, setSelectedOpm] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);

  // Modal para exibir TODOS os campos da planilha quando selecionado
  const [modalOcorrencia, setModalOcorrencia] = useState<Ocorrencia | null>(null);

  // Modo de visualização da tabela: Consolidada ou Todos os Cabeçalhos
  const [viewMode, setViewMode] = useState<'consolidada' | 'todos_cabecalhos'>('consolidada');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  const availableCpas = useMemo(() => {
    const set = new Set(
      ocorrencias.map((o) => normalizeCpaName(o.comandoIntermediario || o.cpa || '')).filter(Boolean)
    );
    return ['TODOS', ...Array.from(set).sort()];
  }, [ocorrencias]);

  const availableOpms = useMemo(() => {
    const set = new Set(
      ocorrencias.map((o) => o.opm || o.uop).filter(Boolean)
    );
    return ['TODAS', ...Array.from(set).sort()];
  }, [ocorrencias]);

  // Contagem para cada uma das 5 perguntas de múltipla escolha
  const countsPerCrimeQuestion = useMemo(() => {
    const counts = {
      'Crimes comuns contra candidatos': 0,
      'Crimes comuns nos locais de votação/apuração': 0,
      'Crimes Eleitorais': 0,
      'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação': 0,
      'Prisões/apreensões no entorno e/ou locais de votação': 0,
    };

    ocorrencias.forEach((oc) => {
      if (!isNaoHouve(oc.crimesCandidatos)) {
        counts['Crimes comuns contra candidatos']++;
      }
      if (!isNaoHouve(oc.crimesLocaisVotacao)) {
        counts['Crimes comuns nos locais de votação/apuração']++;
      }
      if (!isNaoHouve(oc.crimesEleitorais)) {
        counts['Crimes Eleitorais']++;
      }
      if (!isNaoHouve(oc.incidentesSeguranca)) {
        counts[
          'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação'
        ]++;
      }
      if (!isNaoHouve(oc.prisoesApreensoes)) {
        counts['Prisões/apreensões no entorno e/ou locais de votação']++;
      }
    });

    return counts;
  }, [ocorrencias]);

  // Indicadores de Resumo Gerais
  const stats = useMemo(() => {
    const total = ocorrencias.length;
    const opms = new Set<string>();

    ocorrencias.forEach((oc) => {
      const uop = oc.opm || oc.uop;
      if (uop) opms.add(uop);
    });

    return {
      total,
      opmsCount: opms.size,
    };
  }, [ocorrencias]);

  // Filtragem focada na Data do Carimbo de Data/Hora (03OUT ou 04OUT)
  const filteredOcorrencias = useMemo(() => {
    return ocorrencias.filter((oc) => {
      const cpaVal = normalizeCpaName(oc.comandoIntermediario || oc.cpa || '');
      if (selectedCpa !== 'TODOS' && cpaVal !== selectedCpa) return false;

      const opmVal = (oc.opm || oc.uop || '').trim();
      if (selectedOpm !== 'TODAS' && opmVal !== selectedOpm) return false;

      // Filtro de Pergunta de Crime
      if (selectedCrimeFilter !== 'TODOS') {
        let hasCrime = false;
        if (
          selectedCrimeFilter === 'Crimes comuns contra candidatos' &&
          !isNaoHouve(oc.crimesCandidatos)
        ) {
          hasCrime = true;
        } else if (
          selectedCrimeFilter === 'Crimes comuns nos locais de votação/apuração' &&
          !isNaoHouve(oc.crimesLocaisVotacao)
        ) {
          hasCrime = true;
        } else if (
          selectedCrimeFilter === 'Crimes Eleitorais' &&
          !isNaoHouve(oc.crimesEleitorais)
        ) {
          hasCrime = true;
        } else if (
          selectedCrimeFilter ===
            'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação' &&
          !isNaoHouve(oc.incidentesSeguranca)
        ) {
          hasCrime = true;
        } else if (
          selectedCrimeFilter === 'Prisões/apreensões no entorno e/ou locais de votação' &&
          !isNaoHouve(oc.prisoesApreensoes)
        ) {
          hasCrime = true;
        }
        if (!hasCrime) return false;
      }

      // Filtro de Dia focado no Carimbo de Data e Hora e no Serviço do Dia
      if (selectedDay !== 'TODOS') {
        const fallbackText = `${oc.servicoDia || ''} ${oc.dataHoraFato || ''} ${oc.dinamica || ''}`;
        if (!matchesCarimboDate(oc.carimbo, selectedDay, fallbackText)) {
          return false;
        }
      }

      // Busca por texto amplo
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const carimbo = (oc.carimbo || '').toLowerCase();
        const servico = (oc.servicoDia || '').toLowerCase();
        const cpa = cpaVal.toLowerCase();
        const opm = opmVal.toLowerCase();
        const local = (oc.local || oc.bairro || oc.localidade || '').toLowerCase();
        const hora = (oc.hora || '').toLowerCase();
        const bopm = (oc.bopm || '').toLowerCase();
        const ro = (oc.ro || '').toLowerCase();
        const dinamica = (oc.dinamica || oc.historico || '').toLowerCase();
        const informante = `${oc.posto || ''} ${oc.nomeGuerra || ''} ${oc.rg || ''}`.toLowerCase();
        const crimesStr = (oc.crimesRegistrados || []).join(' ').toLowerCase();

        if (
          !carimbo.includes(q) &&
          !servico.includes(q) &&
          !cpa.includes(q) &&
          !opm.includes(q) &&
          !local.includes(q) &&
          !hora.includes(q) &&
          !bopm.includes(q) &&
          !ro.includes(q) &&
          !dinamica.includes(q) &&
          !informante.includes(q) &&
          !crimesStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    ocorrencias,
    selectedCpa,
    selectedOpm,
    selectedCrimeFilter,
    selectedDay,
    searchTerm,
  ]);

  const totalPages = Math.ceil(filteredOcorrencias.length / itemsPerPage) || 1;
  const paginatedOcorrencias = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOcorrencias.slice(start, start + itemsPerPage);
  }, [filteredOcorrencias, currentPage, itemsPerPage]);

  return (
    <div id="ocorrencias-dashboard" className="space-y-3.5">
      {/* 0. CARDS DE RESUMO OPERACIONAL + STATUS DE CONEXÃO DIRETA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Total de Ocorrências / Registros
            </span>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-900">
              {stats.total}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {stats.total === 1 ? '1 registro na planilha' : `${stats.total} registros na planilha`}
            </span>
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
              OPMs com Informações
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

        {/* Card de Conexão com Google Sheets com Botão de Sincronização e Link */}
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
                title="Sincronizar dados com a Planilha de Ocorrências agora"
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

      {/* 1. SEÇÃO DE CATEGORIAS: AS 5 PERGUNTAS DO FORMULÁRIO COM CARDS ORGANIZADOS */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Categorias Oficiais do Formulário Eleitoral</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Respostas registradas nas 5 perguntas oficiais de múltipla escolha. Clique em qualquer categoria para filtrar a tabela:
            </p>
          </div>
          {selectedCrimeFilter !== 'TODOS' && (
            <button
              onClick={() => {
                setSelectedCrimeFilter('TODOS');
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:underline font-bold self-start sm:self-auto cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtro ({selectedCrimeFilter})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {CRIMES_FORMULARIO.map((cat) => {
            const count = countsPerCrimeQuestion[cat.id as keyof typeof countsPerCrimeQuestion] || 0;
            const isSelected = selectedCrimeFilter === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCrimeFilter(isSelected ? 'TODOS' : cat.id);
                  setCurrentPage(1);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">
                    {cat.short}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                    {cat.title}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-black shrink-0 ${
                    count > 0 ? cat.badgeColor : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS: BUSCA, FILTROS DE DATA (03OUT / 04OUT), CPA, OPM E PDF */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
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
              placeholder="Buscar por informante, RG, serviço, comando, OPM, local, BOPM, RO ou dinâmica..."
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
                {availableCpas.map((c) => (
                  <option key={c} value={c}>
                    {c}
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
                {availableOpms.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Alternador de Visão de Colunas */}
            <button
              onClick={() =>
                setViewMode((prev) =>
                  prev === 'consolidada' ? 'todos_cabecalhos' : 'consolidada'
                )
              }
              title={
                viewMode === 'consolidada'
                  ? 'Ver todas as 5 colunas de perguntas individualmente na tabela'
                  : 'Voltar à visão consolidada limpa'
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {viewMode === 'consolidada' ? 'Todas Colunas' : 'Visão Principal'}
              </span>
            </button>

            {/* Menu Dropdown de Exportação em PDF com Filtros de CPA e OPM */}
            <div className="relative inline-block text-left">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() =>
                    exportOcorrenciasPdf(ocorrencias, {
                      dia: selectedDay,
                      cpa: selectedCpa,
                      opm: selectedOpm,
                      crimeFilter: selectedCrimeFilter,
                      search: searchTerm,
                    })
                  }
                  title={`Baixar PDF de Ocorrências filtrado por Comando (${selectedCpa}), OPM (${selectedOpm}) e Período (${selectedDay})`}
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
                          exportOcorrenciasPdf(ocorrencias, {
                            dia: '03OUT',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            crimeFilter: selectedCrimeFilter,
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
                          exportOcorrenciasPdf(ocorrencias, {
                            dia: '04OUT',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            crimeFilter: selectedCrimeFilter,
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
                          exportOcorrenciasPdf(ocorrencias, {
                            dia: 'TODOS',
                            cpa: selectedCpa,
                            opm: selectedOpm,
                            crimeFilter: selectedCrimeFilter,
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
                            exportOcorrenciasPdf(ocorrencias, {
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

      {/* 3. TABELA DE OCORRÊNCIAS COM CABEÇALHOS PRECISOS E ESTRUTURADOS */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[560px]">
          <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1300px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider shadow-xs">
              {viewMode === 'consolidada' ? (
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] bg-slate-900">
                    DATA / HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[170px] bg-slate-900">
                    SERVIÇO DO DIA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[160px] bg-slate-900">
                    INFORMANTE
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                    COMANDO
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    OPM
                  </th>
                  <th className="py-2.5 px-3 min-w-[260px] max-w-[340px] bg-slate-900">
                    CRIME(S) REGISTRADO(S)
                  </th>
                  <th className="py-2.5 px-3 min-w-[150px] max-w-[200px] bg-slate-900">
                    LOCAL
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[70px] text-center bg-slate-900">
                    HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[85px] text-center bg-slate-900">
                    BOPM
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[90px] text-center bg-slate-900">
                    R.O.
                  </th>
                  <th className="py-2.5 px-3 min-w-[220px] max-w-[320px] bg-slate-900">
                    DINÂMICA / HISTÓRICO
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[90px] text-center bg-slate-900">
                    FICHA
                  </th>
                </tr>
              ) : (
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] bg-slate-900">
                    CARIMBO DE DATA/HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[170px] bg-slate-900">
                    SERVIÇO DO DIA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px] bg-slate-900">
                    INFORMANTE
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                    COMANDO
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    OPM
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px] bg-slate-900">
                    1. CONTRA CANDIDATOS
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px] bg-slate-900">
                    2. LOCAIS DE VOTAÇÃO
                  </th>
                  <th className="py-2.5 px-3 min-w-[160px] bg-slate-900">
                    3. CRIMES ELEITORAIS
                  </th>
                  <th className="py-2.5 px-3 min-w-[220px] bg-slate-900">
                    4. INCIDENTES SEGURANÇA
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px] bg-slate-900">
                    5. PRISÕES/APREENSÕES
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px] bg-slate-900">
                    LOCAL
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[70px] text-center bg-slate-900">
                    HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[85px] text-center bg-slate-900">
                    BOPM
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[90px] text-center bg-slate-900">
                    R.O.
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[90px] text-center bg-slate-900">
                    FICHA
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOcorrencias.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'consolidada' ? 12 : 15}
                    className="py-12 text-center text-slate-400"
                  >
                    Nenhuma ocorrência encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedOcorrencias.map((oc, idx) => {
                  const carimboText = oc.carimbo;
                  const servicoText = oc.servicoDia || 'Serviço das Eleições';
                  const cpaText = normalizeCpaName(oc.comandoIntermediario || oc.cpa || '1º CPA');
                  const opmText = oc.opm || oc.uop || 'OPM';
                  const crimesList = getCrimesDaOcorrencia(oc);
                  const localText = oc.local || oc.bairro || 'Local não informado';
                  const horaText = oc.hora || '-';
                  const bopmText = oc.bopm || 'Não informado';
                  const roText = oc.ro || 'Não informado';
                  const dinamicaText = oc.dinamica || oc.historico || '-';

                  const informanteDesc = [
                    oc.posto,
                    oc.nomeGuerra,
                    oc.rg ? `(RG ${oc.rg})` : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  if (viewMode === 'consolidada') {
                    return (
                      <tr
                        key={oc.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        }`}
                      >
                        {/* 1. DATA / HORA */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 align-top">
                          {carimboText}
                        </td>

                        {/* 2. SERVIÇO DO DIA */}
                        <td className="py-2.5 px-3 align-top">
                          <span className="font-semibold text-slate-900 leading-snug block">
                            {servicoText}
                          </span>
                        </td>

                        {/* 3. INFORMANTE */}
                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          {informanteDesc ? (
                            <div className="text-slate-800">
                              <span className="font-bold block text-[11px]">{oc.posto} {oc.nomeGuerra}</span>
                              {oc.rg && <span className="text-[10px] text-slate-500 font-mono">RG: {oc.rg}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* 4. COMANDO */}
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

                        {/* 6. CRIME(S) REGISTRADO(S) */}
                        <td className="py-2.5 px-3 align-top">
                          {crimesList.length > 0 ? (
                            <div className="space-y-1">
                              {crimesList.map((item, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={`flex items-start gap-1 p-1 rounded border text-[11px] font-bold leading-tight ${item.color}`}
                                >
                                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 opacity-80" />
                                  <div className="min-w-0">
                                    <span className="block text-[9px] uppercase tracking-wider opacity-70 font-semibold truncate">
                                      {item.categoria}
                                    </span>
                                    <span className="break-words">{item.crime}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* 7. LOCAL */}
                        <td className="py-2.5 px-3 align-top">
                          <span className="font-semibold text-slate-800 block leading-snug">
                            {localText}
                          </span>
                        </td>

                        {/* 8. HORA */}
                        <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-700 whitespace-nowrap align-top">
                          {horaText}
                        </td>

                        {/* 9. BOPM */}
                        <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {bopmText}
                          </span>
                        </td>

                        {/* 10. RO */}
                        <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {roText}
                          </span>
                        </td>

                        {/* 11. DINÂMICA */}
                        <td className="py-2.5 px-3 align-top">
                          <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-2" title={dinamicaText}>
                            {dinamicaText}
                          </p>
                        </td>

                        {/* 12. FICHA */}
                        <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                          <button
                            onClick={() => setModalOcorrencia(oc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                            title="Ver todos os campos e perguntas da planilha para este envio"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Ficha</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Modo: Todos os Cabeçalhos
                  return (
                    <tr
                      key={oc.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 align-top">
                        {carimboText}
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className="font-semibold text-slate-900 block text-[11px]">
                          {servicoText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span className="font-bold text-slate-800 block text-[11px]">
                          {informanteDesc || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px]">
                          {cpaText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px]">
                          {opmText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`text-[11px] ${!isNaoHouve(oc.crimesCandidatos) ? 'font-bold text-amber-700' : 'text-slate-400'}`}>
                          {oc.crimesCandidatos || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`text-[11px] ${!isNaoHouve(oc.crimesLocaisVotacao) ? 'font-bold text-blue-700' : 'text-slate-400'}`}>
                          {oc.crimesLocaisVotacao || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`text-[11px] ${!isNaoHouve(oc.crimesEleitorais) ? 'font-bold text-purple-700' : 'text-slate-400'}`}>
                          {oc.crimesEleitorais || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`text-[11px] ${!isNaoHouve(oc.incidentesSeguranca) ? 'font-bold text-sky-700' : 'text-slate-400'}`}>
                          {oc.incidentesSeguranca || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`text-[11px] ${!isNaoHouve(oc.prisoesApreensoes) ? 'font-bold text-rose-700' : 'text-slate-400'}`}>
                          {oc.prisoesApreensoes || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className="font-semibold text-slate-800 block text-[11px]">
                          {localText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-700 whitespace-nowrap align-top">
                        {horaText}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px]">
                          {bopmText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px]">
                          {roText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                        <button
                          onClick={() => setModalOcorrencia(oc)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
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
              Mostrando {paginatedOcorrencias.length} de {filteredOcorrencias.length} ocorrências
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

      {/* 4. MODAL COM A FICHA COMPLETA DE TODOS OS 18 CAMPOS DO FORMULÁRIO */}
      {modalOcorrencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Cabeçalho do Modal */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white uppercase">
                    Ficha Completa do Envio • Formulário de Ocorrências
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Carimbo: {modalOcorrencia.carimbo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalOcorrencia(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Bloco 1: Informante & Serviço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Policial Militar Informante</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {modalOcorrencia.posto || 'Policial Militar'} {modalOcorrencia.nomeGuerra || '-'}
                  </div>
                  {modalOcorrencia.rg && (
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      RG PM: {modalOcorrencia.rg}
                    </div>
                  )}
                  {modalOcorrencia.email && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{modalOcorrencia.email}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>Unidade & Serviço</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {normalizeCpaName(modalOcorrencia.comandoIntermediario || modalOcorrencia.cpa || '')} • {modalOcorrencia.opm || modalOcorrencia.uop || '-'}
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5 font-medium">
                    {modalOcorrencia.servicoDia || 'Serviço das Eleições'}
                  </div>
                </div>
              </div>

              {/* Bloco 2: As 5 Categorias Oficiais */}
              <div className="space-y-2">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                  <span>Respostas das 5 Categorias Oficiais do Formulário</span>
                </span>

                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                      1. Crimes comuns contra candidatos
                    </span>
                    {!isNaoHouve(modalOcorrencia.crimesCandidatos) ? (
                      <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{modalOcorrencia.crimesCandidatos}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Não houve</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                      2. Crimes comuns nos locais de votação/apuração
                    </span>
                    {!isNaoHouve(modalOcorrencia.crimesLocaisVotacao) ? (
                      <div className="p-1.5 rounded bg-blue-50 border border-blue-200 text-blue-900 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{modalOcorrencia.crimesLocaisVotacao}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Não houve</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                      3. Crimes Eleitorais
                    </span>
                    {!isNaoHouve(modalOcorrencia.crimesEleitorais) ? (
                      <div className="p-1.5 rounded bg-purple-50 border border-purple-200 text-purple-900 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{modalOcorrencia.crimesEleitorais}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Não houve</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                      4. Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação
                    </span>
                    {!isNaoHouve(modalOcorrencia.incidentesSeguranca) ? (
                      <div className="p-1.5 rounded bg-sky-50 border border-sky-200 text-sky-900 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>{modalOcorrencia.incidentesSeguranca}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Não houve</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                      5. Prisões/apreensões no entorno e/ou locais de votação
                    </span>
                    {!isNaoHouve(modalOcorrencia.prisoesApreensoes) ? (
                      <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-900 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{modalOcorrencia.prisoesApreensoes}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Não houve</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloco 3: Dados Operacionais e Dinâmica */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Local do Fato
                    </span>
                    <span className="font-semibold text-slate-900 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{modalOcorrencia.local || '-'}</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Hora
                    </span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">
                      {modalOcorrencia.hora || '-'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      BOPM / RO
                    </span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">
                      {modalOcorrencia.bopm || 'Sem BOPM'} • {modalOcorrencia.ro || 'Sem RO'}
                    </span>
                  </div>
                </div>

                {/* Dinâmica Completa */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Dinâmica da Ocorrência de Vulto / Interesse
                  </span>
                  <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                    {modalOcorrencia.dinamica || 'Sem relato da dinâmica.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setModalOcorrencia(null)}
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
