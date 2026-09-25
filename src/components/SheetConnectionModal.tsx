import React, { useState } from 'react';
import {
  X,
  Link,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { CsvHelper } from '../lib/csvHelper';
import {
  fetchCsvWithTimeout,
  parseLocaisCsv,
  parseOcorrenciasCsv,
  parseFaltasCsv,
} from '../services/sheetService';
import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';

interface SheetConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocaisUpdated: (data: LocalVotacao[]) => void;
  onOcorrenciasUpdated: (data: Ocorrencia[]) => void;
  onFaltasUpdated: (data: FaltaEfetivo[]) => void;
  onSyncAll?: () => void;
}

export const SheetConnectionModal: React.FC<SheetConnectionModalProps> = ({
  isOpen,
  onClose,
  onLocaisUpdated,
  onOcorrenciasUpdated,
  onFaltasUpdated,
  onSyncAll,
}) => {
  const [locaisUrl, setLocaisUrl] = useState<string>(() => CsvHelper.getLocaisSheetUrl());
  const [ocorrenciasUrl, setOcorrenciasUrl] = useState<string>(() => CsvHelper.getOcorrenciasSheetUrl());
  const [faltasUrl, setFaltasUrl] = useState<string>(() => CsvHelper.getFaltasSheetUrl());

  const [testingSource, setTestingSource] = useState<'locais' | 'ocorrencias' | 'faltas' | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Recarrega URLs salvas sempre que o modal abre
  React.useEffect(() => {
    if (isOpen) {
      setLocaisUrl(CsvHelper.getLocaisSheetUrl());
      setOcorrenciasUrl(CsvHelper.getOcorrenciasSheetUrl());
      setFaltasUrl(CsvHelper.getFaltasSheetUrl());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUrls = async () => {
    setIsSaving(true);
    await CsvHelper.saveAllSheetUrls({
      locaisUrl,
      ocorrenciasUrl,
      faltasUrl,
    });
    setIsSaving(false);
    if (onSyncAll) {
      onSyncAll();
    }
    onClose();
  };

  const handleTestUrl = async (source: 'locais' | 'ocorrencias' | 'faltas', url: string) => {
    if (!url || !url.trim().startsWith('http')) {
      setTestResult((prev) => ({
        ...prev,
        [source]: { success: false, message: 'Informe uma URL válida iniciando com https://' },
      }));
      return;
    }

    setTestingSource(source);
    try {
      const csvText = await fetchCsvWithTimeout(url.trim(), 12000);
      let count = 0;
      if (source === 'locais') {
        const parsed = parseLocaisCsv(csvText);
        count = parsed.length;
        const imp = parsed.filter((l) => l.implantada).length;
        const desmob = parsed.filter((l) => l.desmobilizada).length;
        if (count > 0) {
          onLocaisUpdated(parsed);
          CsvHelper.saveLocais(parsed);
          CsvHelper.setLocaisSheetUrl(url.trim());
        }
        setTestResult((prev) => ({
          ...prev,
          [source]: {
            success: true,
            message: `Conexão bem-sucedida! ${count.toLocaleString('pt-BR')} locais carregados (${imp} urnas implantadas, ${desmob} desmobilizadas).`,
          },
        }));
        return;
      } else if (source === 'ocorrencias') {
        const parsed = parseOcorrenciasCsv(csvText);
        count = parsed.length;
        onOcorrenciasUpdated(parsed);
        CsvHelper.saveOcorrencias(parsed);
        CsvHelper.setOcorrenciasSheetUrl(url.trim());
        const tipoDet = count > 0 ? (parsed[0]?.tipo || 'Registrada') : 'Planilha ativa, 0 ocorrências';
        setTestResult((prev) => ({
          ...prev,
          [source]: {
            success: true,
            message: `Conexão bem-sucedida! ${count} ocorrência(s) encontrada(s) na planilha (${tipoDet}).`,
          },
        }));
        return;
      } else if (source === 'faltas') {
        const parsed = parseFaltasCsv(csvText);
        count = parsed.length;
        onFaltasUpdated(parsed);
        CsvHelper.saveFaltas(parsed);
        CsvHelper.setFaltasSheetUrl(url.trim());
        setTestResult((prev) => ({
          ...prev,
          [source]: {
            success: true,
            message: `Conexão bem-sucedida! ${count} registro(s) de envio do formulário POE carregado(s).`,
          },
        }));
        return;
      }
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [source]: {
          success: false,
          message: err?.message || 'Falha ao acessar link. Verifique se o link foi publicado como CSV no Google.',
        },
      }));
    } finally {
      setTestingSource(null);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'locais' | 'ocorrencias' | 'faltas'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        if (source === 'locais') {
          const parsed = parseLocaisCsv(text);
          if (parsed.length > 0) {
            onLocaisUpdated(parsed);
            CsvHelper.saveLocais(parsed);
            setTestResult((prev) => ({
              ...prev,
              [source]: {
                success: true,
                message: `Arquivo importado: ${parsed.length} locais carregados com sucesso!`,
              },
            }));
          }
        } else if (source === 'ocorrencias') {
          const parsed = parseOcorrenciasCsv(text);
          if (parsed.length > 0) {
            onOcorrenciasUpdated(parsed);
            CsvHelper.saveOcorrencias(parsed);
            setTestResult((prev) => ({
              ...prev,
              [source]: {
                success: true,
                message: `Arquivo importado: ${parsed.length} ocorrências carregadas!`,
              },
            }));
          }
        } else if (source === 'faltas') {
          const parsed = parseFaltasCsv(text);
          if (parsed.length > 0) {
            onFaltasUpdated(parsed);
            CsvHelper.saveFaltas(parsed);
            setTestResult((prev) => ({
              ...prev,
              [source]: {
                success: true,
                message: `Arquivo importado: ${parsed.length} registros de efetivo carregados!`,
              },
            }));
          }
        }
      } catch (err: any) {
        setTestResult((prev) => ({
          ...prev,
          [source]: { success: false, message: `Erro ao ler arquivo: ${err.message}` },
        }));
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight uppercase">
                Conexão com Planilhas Google & Importação Direta
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie os links publicados das 3 bases de dados ou importe arquivos CSV locais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Banner de Fixação Efetiva no Sistema */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-950 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-extrabold text-emerald-900 block uppercase tracking-wide text-[11px]">
                Links Fixados Efetivamente no Sistema (Servidor Central)
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Os links configurados abaixo são salvos de forma permanente no servidor central. Ao abrir o sistema em outro navegador, computador ou celular, as planilhas já estarão conectadas automaticamente sem necessidade de reinserir links.
              </p>
            </div>
          </div>

          {/* Instruções Técnicas */}
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Como vincular a aba "PLANILHA GERAL DASH" (+5.000 locais) e não apenas 1º CPA (608):</span>
            </div>
            <div className="text-[11px] text-amber-900 leading-relaxed space-y-1.5 pl-5.5">
              <p>
                <strong>Método 1 (Mais fácil - Link do Navegador):</strong> Abra a planilha no Google Sheets, clique na aba <strong>PLANILHA GERAL DASH</strong> no rodapé. Copie o endereço completo da barra do navegador (ex: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.../edit#gid=123456789</code>) e cole abaixo. O sistema identifica o <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">gid</code> da aba automaticamente e busca os +5.000 locais!
              </p>
              <p>
                <strong>Método 2 (Publicar na Web):</strong> No Google Sheets, vá em <strong>Arquivo ➔ Compartilhar ➔ Publicar na Web</strong>. No menu que diz "Documento inteiro" ou "1º CPA", selecione <strong>"PLANILHA GERAL DASH"</strong> ➔ Formato: <strong>Valores separados por vírgula (.csv)</strong> ➔ Clique em <strong>Publicar</strong>.
              </p>
              <p>
                <strong>Método 3 (Instantâneo sem link):</strong> Se não puder mexer nas permissões do Google, basta clicar no botão <strong>"Subir CSV"</strong> e escolher o arquivo CSV baixado do Google Sheets.
              </p>
            </div>
          </div>

          {/* 1. Locais de Votação */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  1. Planilha Geral Dash (Locais de Votação)
                </span>
                <p className="text-[11px] text-slate-500">
                  Base principal de locais, zonas eleitorais, implantação e áreas sensíveis
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'locais')}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={locaisUrl}
                onChange={(e) => setLocaisUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestUrl('locais', locaisUrl)}
                disabled={testingSource === 'locais'}
                className="px-3 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSource === 'locais' ? 'animate-spin' : ''}`} />
                <span>Testar / Atualizar</span>
              </button>
            </div>

            {testResult['locais'] && (
              <div
                className={`text-[11px] font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                  testResult['locais'].success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult['locais'].success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult['locais'].message}</span>
              </div>
            )}
          </div>

          {/* 2. Ocorrências */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  2. Planilha de Respostas do Formulário de Ocorrências
                </span>
                <p className="text-[11px] text-slate-500">
                  Respostas registradas pelos operadores no Formulário Google de Ocorrências
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'ocorrencias')}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ocorrenciasUrl}
                onChange={(e) => setOcorrenciasUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestUrl('ocorrencias', ocorrenciasUrl)}
                disabled={testingSource === 'ocorrencias'}
                className="px-3 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSource === 'ocorrencias' ? 'animate-spin' : ''}`} />
                <span>Testar / Atualizar</span>
              </button>
            </div>

            {testResult['ocorrencias'] && (
              <div
                className={`text-[11px] font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                  testResult['ocorrencias'].success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult['ocorrencias'].success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult['ocorrencias'].message}</span>
              </div>
            )}
          </div>

          {/* 3. Faltas de Efetivo POE */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  3. Planilha de Respostas de Faltas no POE
                </span>
                <p className="text-[11px] text-slate-500">
                  Respostas registradas pelo formulário de controle de faltas no POE
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'faltas')}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={faltasUrl}
                onChange={(e) => setFaltasUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestUrl('faltas', faltasUrl)}
                disabled={testingSource === 'faltas'}
                className="px-3 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSource === 'faltas' ? 'animate-spin' : ''}`} />
                <span>Testar / Atualizar</span>
              </button>
            </div>

            {testResult['faltas'] && (
              <div
                className={`text-[11px] font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                  testResult['faltas'].success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult['faltas'].success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult['faltas'].message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Gravado permanentemente no servidor para computadores e celulares.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveUrls}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Gravando no Servidor...' : 'Salvar e Fixar no Sistema'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
