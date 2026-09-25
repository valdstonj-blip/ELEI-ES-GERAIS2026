import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-slate-700 py-4 text-xs">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <p className="font-black text-slate-900 tracking-wide text-xs uppercase">
              EMG-PM/3 — PLANEJAMENTO ELEIÇÕES GERAIS 2026
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              SISTEMA DE GESTÃO E ACOMPANHAMENTO DE LOCAIS DE VOTAÇÃO
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            <span>Uso Interno:</span>
            <strong className="text-slate-800 uppercase font-bold">
              Seção de Planejamento (PM/3)
            </strong>
          </div>
        </div>

        {/* Equipe Responsável e Desenvolvimento Técnico */}
        <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
              Chefe da PM/3
            </span>
            <p className="font-extrabold text-slate-900 mt-0.5 text-xs">
              CORONEL CHRISTOPH
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
              Subchefe da PM/3
            </span>
            <p className="font-extrabold text-slate-900 mt-0.5 text-xs">
              TEN. CORONEL MORAES
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
              Encarregado
            </span>
            <p className="font-extrabold text-slate-900 mt-0.5 text-xs">
              MAJOR ZELENKA
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
              Desenvolvedor
            </span>
            <p className="font-extrabold text-blue-700 mt-0.5 text-xs font-mono">
              Dev.Fiel.26
            </p>
          </div>
        </div>

        <div className="mt-2.5 text-center text-[10px] text-slate-400">
          Uso restrito à equipe técnica da Seção de Planejamento EMG-PM/3.
        </div>
      </div>
    </footer>
  );
};
