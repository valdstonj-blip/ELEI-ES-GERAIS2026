import React from 'react';
import {
  Activity,
  UserX,
  MapPin,
  LogOut,
  RefreshCw,
  FileCheck2,
  Link2,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSyncing: boolean;
  lastSyncTime: string | null;
  onManualSync: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  isAdmin?: boolean;
  userRole?: string;
  counts: {
    locais: number;
    ocorrencias: number;
    faltas: number;
    verificacao?: number;
    sensiveis: number;
    inconsistencias?: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isSyncing,
  lastSyncTime,
  onManualSync,
  onLogout,
  onOpenSettings,
  isAdmin = true,
  userRole = 'admin',
  counts,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* 1. LINHA SUPERIOR: TÍTULO, IDENTIFICAÇÃO DO USUÁRIO E AÇÕES */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Identificação Principal Limpa */}
        <div className="flex items-center justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-sm sm:text-base tracking-tight text-white uppercase leading-none">
                PLANEJAMENTO ELEIÇÕES GERAIS 2026
              </h1>
              <span className="text-[10px] text-blue-400 font-extrabold tracking-wider uppercase shrink-0">
                EMG-PM/3
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 font-semibold">
                2º Turno Oficial • 24 e 25 de Outubro
              </span>
              {isAdmin ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase">
                  ADMIN
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wide bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  USUÁRIO PM3
                </span>
              )}
            </div>
          </div>

          {/* Botão Sair mobile */}
          <button
            onClick={onLogout}
            title="Encerrar Sessão"
            className="sm:hidden p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Ações Diretas: Sincronizar, Planilhas (Apenas Admin) e Sair desktop */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            title={lastSyncTime ? `Última sincronização: ${lastSyncTime}` : 'Sincronizar com Planilhas Google'}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-60 shadow-2xs whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Atualizando...' : 'Sincronizar'}</span>
          </button>

          {/* O usuário PM3 NÃO visualiza configuração/links de planilhas. Apenas ADMIN */}
          {isAdmin && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Configurar Links das Planilhas Google (Acesso Restrito Admin)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Planilhas</span>
            </button>
          )}

          <button
            onClick={onLogout}
            title="Encerrar Sessão"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-rose-400 hover:bg-slate-800/80 transition-colors cursor-pointer border border-transparent hover:border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* 2. LINHA DEDICADA DE NAVEGAÇÃO: TODAS AS 4 ABAS COM ESPAÇO E VISIBILIDADE TOTAL */}
      <div className="bg-slate-950/70 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5">
          <nav className="flex items-center gap-2 overflow-x-auto py-0.5 w-full scrollbar-thin">
            <button
              onClick={() => setActiveTab('locais')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'locais'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>LOCAIS DE VOTAÇÃO</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  activeTab === 'locais'
                    ? 'bg-blue-700/80 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.locais.toLocaleString('pt-BR')}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ocorrencias')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'ocorrencias'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>OCORRÊNCIAS (2º TURNO)</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  activeTab === 'ocorrencias'
                    ? 'bg-blue-700/80 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.ocorrencias}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('faltas')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'faltas'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>FALTAS (2º TURNO)</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  activeTab === 'faltas'
                    ? 'bg-blue-700/80 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {counts.faltas}
              </span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('verificacao')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === 'verificacao'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                <span>VERIFICAÇÃO DE FALTAS</span>
                {counts.inconsistencias !== undefined && counts.inconsistencias > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      activeTab === 'verificacao'
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {counts.inconsistencias}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
