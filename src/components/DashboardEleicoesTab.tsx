import React, { useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  Smartphone,
  Info,
} from 'lucide-react';

const DASHBOARD_URL = 'https://datastudio.google.com/reporting/a9ff90c0-ecd9-4f15-9319-ec1fd6488ed8';
const DASHBOARD_EMBED_URL = 'https://datastudio.google.com/embed/reporting/a9ff90c0-ecd9-4f15-9319-ec1fd6488ed8/page/1M';

export const DashboardEleicoesTab: React.FC = () => {
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(DASHBOARD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* 1. BARRA SUPERIOR DE CONTROLE E ACESSO AO DASHBOARD (RESPONSIVA PARA DESKTOP E CELULAR) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-sm sm:text-base text-slate-900 uppercase tracking-tight">
                Dashboard das Eleições 2026
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                Google Looker Studio
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Painel gerencial e analítico oficial de BI para acompanhamento operacional do pleito
            </p>
          </div>
        </div>

        {/* Ações: Recarregar e Abrir em Nova Aba */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="Recarregar o painel incorporado"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Recarregar</span>
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Abrir o relatório diretamente no Google Looker Studio em tela cheia"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir no Looker Studio</span>
          </button>
        </div>
      </div>

      {/* 2. DICA ESPECÍFICA PARA DISPOSITIVOS MÓVEIS (CELULAR) */}
      <div className="sm:hidden bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-blue-900">
        <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-snug text-[11px]">
          <strong>Dica para Celular:</strong> Para melhor experiência gráfica, você pode girar o aparelho para a <strong>posição horizontal</strong> ou tocar em <strong>"Abrir no Looker Studio"</strong> para abrir diretamente no aplicativo/navegador móvel.
        </p>
      </div>

      {/* 3. AVISO DE AUTENTICAÇÃO E PERMISSÃO DO GOOGLE STUDIO */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-800 block text-[11px]">
            Acesso Restrito e Seguro (Autenticação Google):
          </span>
          <p className="leading-relaxed text-[11px]">
            O painel é protegido e gerenciado pelo Google Looker Studio. Somente os usuários previamente autorizados na conta Google institucional têm acesso aos dados. Se o usuário não tiver permissão cadastrada pelo administrador do Looker, o Google bloqueará a exibição informando <em>"Acesso restrito / Solicite acesso ao proprietário"</em>.
          </p>
        </div>
      </div>

      {/* 4. QUADRO INCORPORADO (IFRAME) DO LOOKER STUDIO COM ALTURA RESPONSIVA */}
      <div className="relative bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden min-h-[520px] sm:min-h-[680px] lg:min-h-[820px] flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-center">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-xs font-bold text-slate-700">
              Carregando Dashboard das Eleições 2026...
            </span>
            <span className="text-[11px] text-slate-400">
              Conectando com os servidores do Google Looker Studio
            </span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={DASHBOARD_EMBED_URL}
          title="Dashboard das Eleições 2026 - Google Looker Studio"
          className="w-full h-full flex-1 border-0 min-h-[520px] sm:min-h-[680px] lg:min-h-[820px]"
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};
