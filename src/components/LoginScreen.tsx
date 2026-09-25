import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (username.trim().toLowerCase() === 'admin' && password === 'admin') {
        localStorage.setItem('eleicoes2026_auth', 'true');
        onLoginSuccess();
      } else {
        setError('Credenciais inválidas. Utilize usuário "admin" e senha "admin".');
        setLoading(false);
      }
    }, 350);
  };

  return (
    <div id="login-screen" className="min-h-screen flex items-center justify-center bg-slate-100 p-4 text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600"></div>

        {/* Institutional crest icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mb-3 text-blue-700 shadow-sm">
            <Shield className="w-9 h-9" />
          </div>
          <span className="text-xs tracking-wider text-slate-500 font-bold uppercase">
            Polícia Militar do Estado do Rio de Janeiro
          </span>
          <span className="text-[11px] tracking-wider text-blue-700 font-semibold uppercase mt-0.5">
            Estado-Maior Geral • 3ª Seção (PM/3)
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-2.5">
            OPERAÇÃO ELEIÇÕES 2026
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Painel Executivo Operacional & Relatórios Oficiais (Planilha Geral Dash)
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Usuário de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="login-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuário (ex: admin)"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Senha Institucional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (ex: admin)"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Acesso padrão:
            </span>
            <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-blue-700 font-semibold">
              admin / admin
            </span>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold rounded-lg text-sm transition-colors shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            Ambiente Seguro • PMERJ EMG/PM-3
          </p>
        </div>
      </div>
    </div>
  );
};
