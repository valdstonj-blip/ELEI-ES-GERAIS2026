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
} from 'lucide-react';
import { Ocorrencia } from '../types';
import { exportOcorrenciasPdf, matchesCarimboDate } from '../services/pdfService';

interface OcorrenciasTabProps {
  ocorrencias: Ocorrencia[];
  onAddOcorrencia?: (nova: Ocorrencia) => void;
  lastSyncTime?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
}

// As 5 perguntas com respostas pré-definidas em múltipla escolha
const CRIMES_FORMULARIO = [
  {
    id: 'Crimes comuns contra candidatos',
    title: 'Crimes comuns contra candidatos',
    short: 'Contra Candidatos',
    key: 'crimesCandidatos' as const,
    color: '#d97706',
  },
  {
    id: 'Crimes comuns nos locais de votação/apuração',
    title: 'Crimes comuns nos locais de votação/apuração',
    short: 'Nos Locais de Votação/Apuração',
    key: 'crimesLocaisVotacao' as const,
    color: '#2563eb',
  },
  {
    id: 'Crimes Eleitorais',
    title: 'Crimes Eleitorais',
    short: 'Crimes Eleitorais',
    key: 'crimesEleitorais' as const,
    color: '#7c3aed',
  },
  {
    id: 'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação',
    title:
      'Ocorrências e Incidentes de Segurança Pública e Defesa Social no entorno e/ou locais de votação',
    short: 'Incidentes Seg. Pública / Entorno',
    key: 'incidentesSeguranca' as const,
    color: '#0284c7',
  },
  {
    id: 'Prisões/apreensões no entorno e/ou locais de votação',
    title: 'Prisões/apreensões no entorno e/ou locais de votação',
    short: 'Prisões / Apreensões no Entorno',
    key: 'prisoesApreensoes' as const,
    color: '#dc2626',
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
      color: 'bg-amber-100 text-amber-900 border-amber-300',
    });
  }
  if (!isNaoHouve(oc.crimesLocaisVotacao)) {
    result.push({
      categoria: 'Locais de Votação/Apuração',
      crime: oc.crimesLocaisVotacao!,
      color: 'bg-blue-100 text-blue-900 border-blue-300',
    });
  }
  if (!isNaoHouve(oc.crimesEleitorais)) {
    result.push({
      categoria: 'Crimes Eleitorais',
      crime: oc.crimesEleitorais!,
      color: 'bg-purple-100 text-purple-900 border-purple-300',
    });
  }
  if (!isNaoHouve(oc.incidentesSeguranca)) {
    result.push({
      categoria: 'Incidentes Seg. Pública / Entorno',
      crime: oc.incidentesSeguranca!,
      color: 'bg-sky-100 text-sky-900 border-sky-300',
    });
  }
  if (!isNaoHouve(oc.prisoesApreensoes)) {
    result.push({
      categoria: 'Prisões/Apreensões Entorno',
      crime: oc.prisoesApreensoes!,
      color: 'bg-rose-100 text-rose-900 border-rose-300',
    });
  }

  // Se nada foi capturado nas propriedades individuais mas há seHouverOcorrenciaDizerQual
  if (result.length === 0 && oc.seHouverOcorrenciaDizerQual && !isNaoHouve(oc.seHouverOcorrenciaDizerQual)) {
    result.push({
      categoria: 'Ocorrência Registrada',
      crime: oc.seHouverOcorrenciaDizerQual,
      color: 'bg-rose-100 text-rose-900 border-rose-300',
    });
  }

  return result;
}

// Indicador circular simples para as 5 perguntas de múltipla escolha
const CircularCategoryGauge: React.FC<{
  title: string;
  categoryName: string;
  value: number;
  total: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ title, categoryName, value, total, color, isActive, onClick }) => {
  const size = 76;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const offset =
    circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <button
      onClick={onClick}
      title={`Filtrar por: ${categoryName}`}
      className={`rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer border w-full ${
        isActive
          ? 'bg-blue-50/90 border-blue-400 shadow-xs ring-2 ring-blue-500/20'
          : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
      }`}
    >
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 h-7 flex items-center justify-center leading-tight">
        {title}
      </span>
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-16 h-16 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {value > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-black text-slate-900 font-sans leading-none">
            {value}
          </span>
          <span className="text-[9px] font-bold text-slate-400 mt-0.5 font-mono">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
};

export const OcorrenciasTab: React.FC<OcorrenciasTabProps> = ({
  ocorrencias,
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
      ocorrencias.map((o) => o.comandoIntermediario || o.cpa).filter(Boolean)
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

  // Filtragem focada na Data do Carimbo de Data/Hora (03OUT ou 04OUT)
  const filteredOcorrencias = useMemo(() => {
    return ocorrencias.filter((oc) => {
      const cpaVal = oc.comandoIntermediario || oc.cpa || '';
      if (selectedCpa !== 'TODOS' && cpaVal !== selectedCpa) return false;

      const opmVal = oc.opm || oc.uop || '';
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

      // Filtro de Dia focado no Carimbo de Data e Hora (03OUT ou 04OUT)
      if (selectedDay !== 'TODOS') {
        if (
          !matchesCarimboDate(
            oc.carimbo,
            selectedDay,
            `${oc.dataHoraFato || ''} ${oc.dinamica || ''}`
          )
        ) {
          return false;
        }
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          (oc.carimbo || '').toLowerCase().includes(q) ||
          (oc.comandoIntermediario || oc.cpa || '').toLowerCase().includes(q) ||
          (oc.opm || oc.uop || '').toLowerCase().includes(q) ||
          (oc.seHouverOcorrenciaDizerQual || '').toLowerCase().includes(q) ||
          (oc.local || '').toLowerCase().includes(q) ||
          (oc.hora || '').toLowerCase().includes(q) ||
          (oc.bopm || '').toLowerCase().includes(q) ||
          (oc.ro || '').toLowerCase().includes(q) ||
          (oc.dinamica || '').toLowerCase().includes(q) ||
          (oc.crimesLocaisVotacao || '').toLowerCase().includes(q) ||
          (oc.crimesCandidatos || '').toLowerCase().includes(q) ||
          (oc.crimesEleitorais || '').toLowerCase().includes(q) ||
          (oc.incidentesSeguranca || '').toLowerCase().includes(q) ||
          (oc.prisoesApreensoes || '').toLowerCase().includes(q);

        if (!matches) return false;
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
      {/* 0. Seção: Ocorrência relacionada ao Pleito Eleitoral - As 5 Perguntas com Múltipla Escolha */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span>Ocorrência relacionada ao Pleito Eleitoral</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                {ocorrencias.length} {ocorrencias.length === 1 ? 'Registro' : 'Registros'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Respostas pré-definidas em múltipla escolha por categoria do formulário (clique em qualquer uma para filtrar a tabela)
            </p>
          </div>
          {selectedCrimeFilter !== 'TODOS' && (
            <button
              onClick={() => setSelectedCrimeFilter('TODOS')}
              className="text-xs text-blue-600 hover:underline font-bold self-start sm:self-auto cursor-pointer"
            >
              Exibir todas
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {CRIMES_FORMULARIO.map((cat) => {
            const val =
              countsPerCrimeQuestion[
                cat.id as keyof typeof countsPerCrimeQuestion
              ] || 0;
            const isSelected = selectedCrimeFilter === cat.id;

            return (
              <CircularCategoryGauge
                key={cat.id}
                title={cat.short}
                categoryName={cat.title}
                value={val}
                total={ocorrencias.length}
                color={cat.color}
                isActive={isSelected}
                onClick={() => {
                  setSelectedCrimeFilter(isSelected ? 'TODOS' : cat.id);
                  setCurrentPage(1);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 1. Barra de Ferramentas com Filtro de Data do Carimbo (03OUT e 04OUT) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
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
              placeholder="Buscar por data, comando, OPM, local, BOPM, RO ou dinâmica..."
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

          {/* Filtros de CPA, OPM, Alternador de Modo e PDF */}
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

            {/* Alternador entre Modo Consolidado (com Modal) e Todos os Cabeçalhos */}
            <button
              onClick={() =>
                setViewMode((prev) =>
                  prev === 'consolidada' ? 'todos_cabecalhos' : 'consolidada'
                )
              }
              title={
                viewMode === 'consolidada'
                  ? 'Clique para exibir todas as 5 colunas de perguntas individualmente na tabela'
                  : 'Clique para voltar à visão operacional'
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {viewMode === 'consolidada'
                  ? 'Ver Todos Cabeçalhos'
                  : 'Ver Visão Principal'}
              </span>
            </button>

            {/* Menu Dropdown de Exportação em PDF com Seleção de Data */}
            <div className="relative inline-block text-left">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => exportOcorrenciasPdf(ocorrencias, selectedDay)}
                  title={`Baixar PDF de Ocorrências (${selectedDay === 'TODOS' ? 'Geral - Todos os Dias' : selectedDay})`}
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
                          exportOcorrenciasPdf(ocorrencias, '03OUT');
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
                          exportOcorrenciasPdf(ocorrencias, '04OUT');
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
                          exportOcorrenciasPdf(ocorrencias, 'TODOS');
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

      {/* 2. Tabela de Ocorrências com Suporte a Múltiplos Crimes por Linha e Botão de Ficha Completa */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
          <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1300px]">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider shadow-xs">
              {viewMode === 'consolidada' ? (
                /* Visão Principal: Lista todos os crimes assinalados e botão para Ficha Completa */
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] bg-slate-900">
                    CARIMBO DATA HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px] text-center bg-slate-900">
                    COMANDO INTERMEDIÁRIO
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    OPM
                  </th>
                  <th className="py-2.5 px-3 min-w-[280px] max-w-[380px] bg-slate-900">
                    CRIMES REGISTRADOS NO PLEITO (PLANILHA)
                  </th>
                  <th className="py-2.5 px-3 min-w-[160px] max-w-[220px] bg-slate-900">
                    LOCAL
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[75px] text-center bg-slate-900">
                    HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    BOPM
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    RO
                  </th>
                  <th className="py-2.5 px-3 min-w-[240px] max-w-[380px] bg-slate-900">
                    DINÂMICA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                    FICHA
                  </th>
                </tr>
              ) : (
                /* Todos os Cabeçalhos da Planilha com as 5 Perguntas de Múltipla Escolha */
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px] bg-slate-900">
                    CARIMBO DE DATA/HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px] text-center bg-slate-900">
                    COMANDO INTERMEDIÁRIO
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    OPM
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px] bg-slate-900">
                    CRIMES COMUNS CONTRA CANDIDATOS
                  </th>
                  <th className="py-2.5 px-3 min-w-[230px] bg-slate-900">
                    CRIMES COMUNS NOS LOCAIS DE VOTAÇÃO/APURAÇÃO
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px] bg-slate-900">
                    CRIMES ELEITORAIS
                  </th>
                  <th className="py-2.5 px-3 min-w-[260px] bg-slate-900">
                    OCORRÊNCIAS E INCIDENTES DE SEGURANÇA PÚBLICA...
                  </th>
                  <th className="py-2.5 px-3 min-w-[210px] bg-slate-900">
                    PRISÕES/APREENSÕES NO ENTORNO...
                  </th>
                  <th className="py-2.5 px-3 min-w-[160px] bg-slate-900">
                    LOCAL
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[75px] text-center bg-slate-900">
                    HORA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    BOPM
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[95px] text-center bg-slate-900">
                    RO
                  </th>
                  <th className="py-2.5 px-3 min-w-[240px] bg-slate-900">
                    DINÂMICA
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px] text-center bg-slate-900">
                    FICHA
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOcorrencias.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'consolidada' ? 10 : 14}
                    className="py-12 text-center text-slate-400"
                  >
                    Nenhuma ocorrência encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedOcorrencias.map((oc, idx) => {
                  const carimboText = oc.carimbo;
                  const cpaText = oc.comandoIntermediario || oc.cpa || '1º CPA';
                  const opmText = oc.opm || oc.uop || 'OPM';
                  const crimesList = getCrimesDaOcorrencia(oc);
                  const localText = oc.local || oc.bairro || 'Local não informado';
                  const horaText = oc.hora || '-';
                  const bopmText = oc.bopm || 'Não informado';
                  const roText = oc.ro || 'Não informado';
                  const dinamicaText = oc.dinamica || oc.historico || '-';

                  if (viewMode === 'consolidada') {
                    return (
                      <tr
                        key={oc.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        }`}
                      >
                        {/* 1. CARIMBO DATA HORA */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 align-top">
                          {carimboText}
                        </td>

                        {/* 2. COMANDO INTERMEDIÁRIO */}
                        <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                            {cpaText}
                          </span>
                        </td>

                        {/* 3. OPM */}
                        <td className="py-2.5 px-3 font-bold text-center whitespace-nowrap align-top">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold">
                            {opmText}
                          </span>
                        </td>

                        {/* 4. CRIMES REGISTRADOS NO PLEITO (Pode haver mais de um no mesmo formulário!) */}
                        <td className="py-2.5 px-3 align-top">
                          {crimesList.length > 0 ? (
                            <div className="space-y-1">
                              {crimesList.map((item, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={`flex items-start gap-1.5 p-1.5 rounded border text-[11px] font-bold leading-tight ${item.color}`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-80" />
                                  <div>
                                    <span className="block text-[9px] uppercase tracking-wider opacity-75 font-semibold">
                                      {item.categoria}
                                    </span>
                                    <span>{item.crime}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-medium border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              <span>Não houve</span>
                            </div>
                          )}
                        </td>

                        {/* 5. LOCAL */}
                        <td className="py-2.5 px-3 align-top">
                          <span className="font-semibold text-slate-800 block leading-snug">
                            {localText}
                          </span>
                        </td>

                        {/* 6. HORA */}
                        <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-700 whitespace-nowrap align-top">
                          {horaText}
                        </td>

                        {/* 7. BOPM */}
                        <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {bopmText}
                          </span>
                        </td>

                        {/* 8. RO */}
                        <td className="py-2.5 px-3 font-mono text-center text-slate-700 whitespace-nowrap align-top">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {roText}
                          </span>
                        </td>

                        {/* 9. DINÂMICA */}
                        <td className="py-2.5 px-3 align-top">
                          <p className="text-[11px] text-slate-700 leading-relaxed break-words">
                            {dinamicaText}
                          </p>
                        </td>

                        {/* 10. FICHA COMPLETA (MODAL) */}
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

                  // Modo: Todos os Cabeçalhos da Planilha
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

                      {/* 5 Perguntas */}
                      <td className="py-2.5 px-3 text-[11px] align-top">
                        {isNaoHouve(oc.crimesCandidatos) ? (
                          <span className="text-slate-400">Não houve</span>
                        ) : (
                          <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
                            {oc.crimesCandidatos}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] align-top">
                        {isNaoHouve(oc.crimesLocaisVotacao) ? (
                          <span className="text-slate-400">Não houve</span>
                        ) : (
                          <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block">
                            {oc.crimesLocaisVotacao}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] align-top">
                        {isNaoHouve(oc.crimesEleitorais) ? (
                          <span className="text-slate-400">Não houve</span>
                        ) : (
                          <span className="font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 block">
                            {oc.crimesEleitorais}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] align-top">
                        {isNaoHouve(oc.incidentesSeguranca) ? (
                          <span className="text-slate-400">Não houve</span>
                        ) : (
                          <span className="font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 block">
                            {oc.incidentesSeguranca}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] align-top">
                        {isNaoHouve(oc.prisoesApreensoes) ? (
                          <span className="text-slate-400">Não houve</span>
                        ) : (
                          <span className="font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 block">
                            {oc.prisoesApreensoes}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 align-top font-medium">
                        {localText}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center align-top">
                        {horaText}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center align-top">
                        {bopmText}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center align-top">
                        {roText}
                      </td>
                      <td className="py-2.5 px-3 align-top text-[11px]">
                        {dinamicaText}
                      </td>
                      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                        <button
                          onClick={() => setModalOcorrencia(oc)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                          title="Ver Ficha Completa"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Exibindo</span>
            <select
              value={itemsPerPage}
              onChange={() => {
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              de <strong>{filteredOcorrencias.length}</strong> registro(s) da planilha
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

      {/* 3. MODAL: Ficha Completa da Ocorrência (Exibe TODOS os campos da planilha) */}
      {modalOcorrencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Ficha Completa da Ocorrência
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Registro individual sincronizado com o Formulário Google
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOcorrencia(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal com Todos os Campos */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* Identificação Geral */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Carimbo de Data/Hora
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {modalOcorrencia.carimbo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Comando Intermediário
                  </span>
                  <span className="font-bold text-indigo-700 text-xs">
                    {modalOcorrencia.comandoIntermediario || modalOcorrencia.cpa}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    OPM
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {modalOcorrencia.opm || modalOcorrencia.uop}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Hora do Fato
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {modalOcorrencia.hora || '-'}
                  </span>
                </div>
              </div>

              {/* As 5 Perguntas de Múltipla Escolha da Planilha */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  <span>Respostas das 5 Categorias de Crimes no Pleito</span>
                </h4>

                <div className="space-y-2">
                  {/* 1. Contra Candidatos */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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

                  {/* 2. Nos Locais de Votação/Apuração */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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

                  {/* 3. Crimes Eleitorais */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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

                  {/* 4. Incidentes de Segurança Pública */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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

                  {/* 5. Prisões / Apreensões */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
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

              {/* Detalhamento do Fato: Local, BOPM, RO e Dinâmica */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-1">
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
                      BOPM
                    </span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">
                      {modalOcorrencia.bopm || 'Não informado'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      RO (Registro Policial)
                    </span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">
                      {modalOcorrencia.ro || 'Não informado'}
                    </span>
                  </div>
                </div>

                {/* Dinâmica */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Dinâmica dos Fatos
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
