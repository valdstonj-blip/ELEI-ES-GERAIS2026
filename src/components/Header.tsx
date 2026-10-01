import React from 'react';
import {
  Activity,
  UserX,
  MapPin,
  LogOut,
  RefreshCw,
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
  counts: {
    locais: number;
    ocorrencias: number;
    faltas: number;
    sensiveis: number;
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
  counts,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Identificação Principal Limpa */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-sm md:text-base tracking-tight text-white uppercase leading-none">
              PLANEJAMENTO ELEIÇÕES GERAIS 2026
            </h1>
            <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase">
              EMG-PM/3
            </span>
          </div>

          {/* Logout mobile */}
          <button
            onClick={onLogout}
            title="Encerrar Sessão"
            className="md:hidden p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Abas Principais em estilo refinado */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            onClick={() => setActiveTab('locais')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ocorrencias'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>OCORRÊNCIAS</span>
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'faltas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>FALTAS</span>
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
        </nav>

        {/* Ações Diretas: Sincronizar, Conectar e Sair */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            title={lastSyncTime ? `Última sincronização: ${lastSyncTime}` : 'Sincronizar com Planilhas Google'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Atualizando...' : 'Sincronizar'}</span>
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Configurar Links das Planilhas"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Conectar Planilhas</span>
            </button>
          )}

          <button
            onClick={onLogout}
            title="Encerrar Sessão"
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
