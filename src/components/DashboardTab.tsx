import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CalendarCheck,
  Truck,
  Users,
  AlertCircle,
  FileDown,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ArrowRight,
  Info,
  Layers,
  FileText,
} from 'lucide-react';
import { LocalVotacao, Ocorrencia, FaltaEfetivo, ActiveTab } from '../types';
import { exportImplantacaoDesmobilizacaoPdf } from '../services/pdfService';

interface DashboardTabProps {
  locais: LocalVotacao[];
  ocorrencias: Ocorrencia[];
  faltas: FaltaEfetivo[];
  onNavigateTab: (tab: ActiveTab) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  locais,
  ocorrencias,
  faltas,
  onNavigateTab,
}) => {
  const [selectedUop, setSelectedUop] = useState<string>('TODOS');
  const [obsSearch, setObsSearch] = useState<string>('');

  const uops = useMemo(() => {
    const list = Array.from(new Set(locais.map((l) => l.uop).filter(Boolean))).sort();
    return ['TODOS', ...list];
  }, [locais]);

  const filteredLocais = useMemo(() => {
    if (selectedUop === 'TODOS') return locais;
    return locais.filter((l) => l.uop === selectedUop);
  }, [locais, selectedUop]);

  // Core Questions from "Planilha Geral Dash"
  const metrics = useMemo(() => {
    const total = filteredLocais.length;
    const areasSensiveis = filteredLocais.filter((l) => l.areaSensivel).length;
    const implantacaoDomingo = filteredLocais.filter((l) => l.necessidadeImplantacaoDomingo).length;
    const utilizacaoBlindado = filteredLocais.filter((l) => l.utilizacaoBlindado).length;

    const efetivoSabado = filteredLocais.reduce((sum, l) => sum + (l.efetivoSabado || 0), 0);
    const efetivoDomingo = filteredLocais.reduce((sum, l) => sum + (l.efetivoDomingo || 0), 0);
    const totalEleitores = filteredLocais.reduce((sum, l) => sum + (l.totalEleitoresAptos || 0), 0);
    const totalSecoes = filteredLocais.reduce((sum, l) => sum + (l.quantidadeSecoes || 0), 0);

    const comObservacao = filteredLocais.filter(
      (l) => l.observacao && l.observacao.trim() !== '' && l.observacao !== '-'
    );

    const implantadas = filteredLocais.filter((l) => l.implantada).length;
    const naoImplantadas = total - implantadas;
    const percImplantadas = total > 0 ? ((implantadas / total) * 100).toFixed(2) : '0.00';

    const desmobilizadas = filteredLocais.filter((l) => l.desmobilizada).length;
    const naoDesmobilizadas = total - desmobilizadas;
    const percDesmobilizadas = total > 0 ? ((desmobilizadas / total) * 100).toFixed(2) : '0.00';

    return {
      total,
      areasSensiveis,
      percSensiveis: total > 0 ? ((areasSensiveis / total) * 100).toFixed(1) : '0',
      implantacaoDomingo,
      percDomingo: total > 0 ? ((implantacaoDomingo / total) * 100).toFixed(1) : '0',
      utilizacaoBlindado,
      percBlindado: total > 0 ? ((utilizacaoBlindado / total) * 100).toFixed(1) : '0',
      efetivoSabado,
      efetivoDomingo,
      totalEleitores,
      totalSecoes,
      comObservacao,
      implantadas,
      naoImplantadas,
      percImplantadas,
      desmobilizadas,
      naoDesmobilizadas,
      percDesmobilizadas,
    };
  }, [filteredLocais]);

  // Filtered observations table
  const filteredObservacoes = useMemo(() => {
    if (!obsSearch) return metrics.comObservacao;
    const q = obsSearch.toLowerCase();
    return metrics.comObservacao.filter(
      (l) =>
        l.local.toLowerCase().includes(q) ||
        l.bairro.toLowerCase().includes(q) ||
        l.observacao.toLowerCase().includes(q) ||
        l.uop.toLowerCase().includes(q)
    );
  }, [metrics.comObservacao, obsSearch]);

  return (
    <div id="dashboard-tab-view" className="space-y-6">
      {/* Strategic Header & UOP Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              QUADRO EXECUTIVO • PLANILHA GERAL DASH
            </h2>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              ELEIÇÕES 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Respostas operacionais consolidadas para o planejamento e emprego do efetivo no 1º e 2º turno.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* UOP Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Filtrar OPM:</span>
            <select
              value={selectedUop}
              onChange={(e) => setSelectedUop(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              {uops.map((uop) => (
                <option key={uop} value={uop} className="text-slate-900 bg-white">
                  {uop === 'TODOS' ? 'TODAS AS UNIDADES' : uop}
                </option>
              ))}
            </select>
          </div>

          {/* Export Executive PDF */}
          <button
            onClick={() => exportImplantacaoDesmobilizacaoPdf(filteredLocais, { cpa: 'TODOS', uop: selectedUop })}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Relatório Oficial PDF</span>
          </button>
        </div>
      </div>

      {/* 4 CORE EXECUTIVE KPI CARDS (The exact user-requested questions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. ÁREAS SENSÍVEIS */}
        <div className="bg-white border-2 border-rose-200 hover:border-rose-300 rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              1. Áreas Sensíveis
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-700 font-mono">
                {metrics.areasSensiveis}
              </span>
              <span className="text-xs text-rose-800 font-bold">
                de {metrics.total} locais
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              Representa <strong className="text-rose-700 font-bold">{metrics.percSensiveis}%</strong> dos colégios eleitorais mapeados sob risco ou facção.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-800 font-medium">
            <span>Requer reforço tático</span>
            <span className="font-bold">Prioridade 1</span>
          </div>
        </div>

        {/* 2. IMPLANTAÇÃO NO DOMINGO */}
        <div className="bg-white border-2 border-amber-200 hover:border-amber-300 rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              2. Implantação Domingo
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-700 font-mono">
                {metrics.implantacaoDomingo}
              </span>
              <span className="text-xs text-amber-800 font-bold">
                locais (04/OUT)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              Urnas instaladas no <strong className="text-amber-700 font-bold">próprio domingo</strong> ({metrics.percDomingo}%) por motivo de segurança.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center justify-between text-[11px] text-amber-800 font-medium">
            <span>Início às 05:00h</span>
            <span className="font-bold">Escolta Rápida</span>
          </div>
        </div>

        {/* 3. UTILIZAÇÃO DE BLINDADO */}
        <div className="bg-white border-2 border-blue-200 hover:border-blue-300 rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              3. Utilização de Blindado
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-700 font-mono">
                {metrics.utilizacaoBlindado}
              </span>
              <span className="text-xs text-blue-800 font-bold">
                locais com VtrBld
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              Escolta pesada / apoio blindado (<strong className="text-blue-700 font-bold">{metrics.percBlindado}%</strong>) para transporte de urnas e tropas.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-[11px] text-blue-800 font-medium">
            <span>UOPs / COE</span>
            <span className="font-bold">Corredor Seguro</span>
          </div>
        </div>

        {/* 4. EFETIVO SUGERIDO NAS DUAS DATAS */}
        <div className="bg-white border-2 border-emerald-200 hover:border-emerald-300 rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              4. Efetivo Sugerido
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Sábado (03/OUT - Véspera):</span>
              <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                {metrics.efetivoSabado} PMs
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Domingo (04/OUT - Pleito):</span>
              <strong className="font-mono text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                {metrics.efetivoDomingo} PMs
              </strong>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
            <span>Votação e Seções</span>
            <span className="font-bold">Turnos 1 e 2</span>
          </div>
        </div>
      </div>

      {/* PAINEL OPERACIONAL: INÍCIO DO EVENTO (IMPLANTAÇÃO) & TÉRMINO (DESMOBILIZAÇÃO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Implantação */}
        <div className="bg-white border-2 border-emerald-500/40 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Início do Evento — Coluna 19
              </span>
              <h3 className="text-sm font-black text-slate-900">
                URNA IMPLANTADA NO LOCAL DE VOTAÇÃO
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black font-mono">
              {metrics.percImplantadas}% Concluído
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Já Implantadas</span>
              <p className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
                {metrics.implantadas.toLocaleString('pt-BR')} <span className="text-xs font-bold text-emerald-700">locais</span>
              </p>
            </div>
            <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 uppercase block">Ainda NÃO Implantadas</span>
              <p className="text-2xl font-black text-rose-800 font-mono mt-0.5">
                {metrics.naoImplantadas.toLocaleString('pt-BR')} <span className="text-xs font-bold text-rose-700">pendentes</span>
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${metrics.percImplantadas}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              onClick={() => onNavigateTab('locais')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver pendências na Planilha Geral Dash</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Desmobilização */}
        <div className="bg-white border-2 border-blue-500/40 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                Término do Evento — Coluna 20
              </span>
              <h3 className="text-sm font-black text-slate-900">
                DESMOBILIZAÇÃO DO LOCAL DE VOTAÇÃO
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-black font-mono">
              {metrics.percDesmobilizadas}% Concluído
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Já Desmobilizados</span>
              <p className="text-2xl font-black text-blue-800 font-mono mt-0.5">
                {metrics.desmobilizadas.toLocaleString('pt-BR')} <span className="text-xs font-bold text-blue-700">locais</span>
              </p>
            </div>
            <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-300">
              <span className="text-[10px] font-bold text-slate-800 uppercase block">Aguardando Desmobilização</span>
              <p className="text-2xl font-black text-slate-800 font-mono mt-0.5">
                {metrics.naoDesmobilizadas.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-600">em votação</span>
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${metrics.percDesmobilizadas}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              onClick={() => onNavigateTab('locais')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver status na Planilha Geral Dash</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] block">
            Total de Locais de Votação
          </span>
          <p className="text-lg font-black text-slate-900 mt-0.5">
            {metrics.total} <span className="text-xs font-normal text-slate-500">colégios</span>
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] block">
            Total de Seções Eleitorais
          </span>
          <p className="text-lg font-black text-slate-900 mt-0.5">
            {metrics.totalSecoes.toLocaleString('pt-BR')}{' '}
            <span className="text-xs font-normal text-slate-500">urnas</span>
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] block">
            Eleitores Aptos a Votar
          </span>
          <p className="text-lg font-black text-slate-900 mt-0.5">
            {metrics.totalEleitores.toLocaleString('pt-BR')}{' '}
            <span className="text-xs font-normal text-slate-500">cidadãos</span>
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] block">
            Locais com Alteração / Obs.
          </span>
          <p className="text-lg font-black text-indigo-700 mt-0.5">
            {metrics.comObservacao.length}{' '}
            <span className="text-xs font-normal text-slate-500">processos SEI / TRE</span>
          </p>
        </div>
      </div>

      {/* DEDICATED TABLE: OBSERVAÇÕES E ALTERAÇÕES (Explicitly requested by the user) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-black text-slate-900 uppercase">
                TABELA DE OBSERVAÇÕES E ALTERAÇÕES ({filteredObservacoes.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Locais com processos SEI, decisões do TRE, remoções, remanejamento de seções ou notas especiais de segurança.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={obsSearch}
              onChange={(e) => setObsSearch(e.target.value)}
              placeholder="Pesquisar em observações..."
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-56"
            />

            <button
              onClick={() => exportImplantacaoDesmobilizacaoPdf(filteredObservacoes, { cpa: 'TODOS', uop: selectedUop })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-2.5 px-3">Batalhão / UOP</th>
                <th className="py-2.5 px-3">Zona / Seções</th>
                <th className="py-2.5 px-3">Local de Votação</th>
                <th className="py-2.5 px-3">Bairro</th>
                <th className="py-2.5 px-3">Observação / Alteração Registrada</th>
                <th className="py-2.5 px-3 text-center">Sensível</th>
                <th className="py-2.5 px-3 text-center">Impl. Domingo</th>
                <th className="py-2.5 px-3 text-center">Blindado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredObservacoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum local com observação ou alteração para este filtro.
                  </td>
                </tr>
              ) : (
                filteredObservacoes.map((loc) => {
                  const isRemovida = loc.observacao.toUpperCase().includes('REMOVIDA');
                  const isSei = loc.observacao.toUpperCase().includes('SEI');

                  return (
                    <tr
                      key={loc.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isRemovida ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px]">
                          {loc.uop}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                        <span className="font-bold text-blue-700">{loc.zonaEleitoral}</span>
                        <span className="text-slate-400 ml-1">({loc.quantidadeSecoes} seç.)</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title={loc.local}>
                        {loc.local}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {loc.bairro}
                      </td>
                      <td className="py-2.5 px-3">
                        <div
                          className={`p-2 rounded border text-xs leading-relaxed font-medium ${
                            isRemovida
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : isSei
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          {loc.observacao}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {loc.areaSensivel ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            SIM
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">NÃO</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {loc.necessidadeImplantacaoDomingo ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            SIM
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">NÃO</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {loc.utilizacaoBlindado ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            SIM
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">NÃO</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ACCESS ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('locais')}
          className="bg-white border border-slate-200 hover:border-blue-400 p-4 rounded-xl shadow-xs cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Ver Todos os {locais.length} Locais de Votação
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Filtre por bairro, zona eleitoral, endereço completo e seções.
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('ocorrencias')}
          className="bg-white border border-slate-200 hover:border-blue-400 p-4 rounded-xl shadow-xs cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Módulo de Ocorrências (Modelo)
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Exemplo da eleição anterior estruturado para receber novos registros.
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('faltas')}
          className="bg-white border border-slate-200 hover:border-blue-400 p-4 rounded-xl shadow-xs cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Controle de Faltas e Efetivo (Modelo)
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Controle de substituições de PMs escalados por turno e local.
          </p>
        </div>
      </div>
    </div>
  );
};
