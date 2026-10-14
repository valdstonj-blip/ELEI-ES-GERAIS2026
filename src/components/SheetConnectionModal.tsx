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
  Trash2,
  Sparkles,
} from 'lucide-react';
import { CsvHelper } from '../lib/csvHelper';
import {
  fetchCsvWithTimeout,
  parseLocaisCsv,
  parseOcorrenciasCsv,
  parseFaltasCsv,
} from '../services/sheetService';
import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';
import { INITIAL_OCORRENCIAS, INITIAL_FALTAS } from '../data/mockData';

interface SheetConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocaisUpdated: (data: LocalVotacao[]) => void;
  onOcorrenciasUpdated: (data: Ocorrencia[]) => void;
  onFaltasUpdated: (data: FaltaEfetivo[]) => void;
  onVerificacaoUpdated?: (data: FaltaEfetivo[]) => void;
  onSyncAll?: () => void;
  onReset2Turno?: () => void;
}

export const SheetConnectionModal: React.FC<SheetConnectionModalProps> = ({
  isOpen,
  onClose,
  onLocaisUpdated,
  onOcorrenciasUpdated,
  onFaltasUpdated,
  onVerificacaoUpdated,
  onSyncAll,
  onReset2Turno,
}) => {
  const [locaisUrl, setLocaisUrl] = useState<string>(() => CsvHelper.getLocaisSheetUrl());
  const [ocorrenciasUrl, setOcorrenciasUrl] = useState<string>(() => CsvHelper.getOcorrenciasSheetUrl());
  const [faltasUrl, setFaltasUrl] = useState<string>(() => CsvHelper.getFaltasSheetUrl());
  const [verificacaoUrl, setVerificacaoUrl] = useState<string>(() => CsvHelper.getVerificacaoSheetUrl());

  const [testingSource, setTestingSource] = useState<'locais' | 'ocorrencias' | 'faltas' | 'verificacao' | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);

  // Recarrega URLs salvas sempre que o modal abre
  React.useEffect(() => {
    if (isOpen) {
      setLocaisUrl(CsvHelper.getLocaisSheetUrl());
      setOcorrenciasUrl(CsvHelper.getOcorrenciasSheetUrl());
      setFaltasUrl(CsvHelper.getFaltasSheetUrl());
      setVerificacaoUrl(CsvHelper.getVerificacaoSheetUrl());
      setClearSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUrls = async () => {
    setIsSaving(true);
    const cleanFaltas = (faltasUrl.trim() || verificacaoUrl.trim());
    const cleanVerif = (verificacaoUrl.trim() || faltasUrl.trim());

    await CsvHelper.saveAllSheetUrls({
      locaisUrl: locaisUrl.trim(),
      ocorrenciasUrl: ocorrenciasUrl.trim(),
      faltasUrl: cleanFaltas,
      verificacaoUrl: cleanVerif,
    });
    setIsSaving(false);
    if (onSyncAll) {
      onSyncAll();
    }
    onClose();
  };

  const handleClearCacheAndReset = async () => {
    if (!window.confirm('Tem certeza que deseja limpar os caches do 1º turno e redefinir para o 2º Turno Oficial? Todas as ocorrências antigas serão removidas, deixando apenas os registros do 2º Turno.')) {
      return;
    }
    setIsClearing(true);
    await CsvHelper.clearAllCachesAndResetTo2Turno();
    setOcorrenciasUrl('');
    setFaltasUrl('');
    setVerificacaoUrl('');
    setTestResult({});
    onOcorrenciasUpdated(INITIAL_OCORRENCIAS);
    onFaltasUpdated(INITIAL_FALTAS);
    if (onVerificacaoUpdated) {
      onVerificacaoUpdated(INITIAL_FALTAS);
    }
    if (onReset2Turno) {
      onReset2Turno();
    }
    setIsClearing(false);
    setClearSuccessMsg('Caches purgados com sucesso! O sistema está pronto para as novas planilhas do 2º Turno.');
  };

  const handleTestUrl = async (source: 'locais' | 'ocorrencias' | 'faltas' | 'verificacao', url: string) => {
    if (!url || !url.trim().startsWith('http')) {
      setTestResult((prev) => ({
        ...prev,
        [source]: { success: false, message: 'Informe uma URL válida iniciando com https://' },
      }));
      return;
    }

    if (url.includes('docs.google.com/forms/')) {
      setTestResult((prev) => ({
        ...prev,
        [source]: {
          success: false,
          message: 'Atenção: Este é o link do FORMULÁRIO (Google Forms). Para conectar no sistema, abra a aba "Respostas" do formulário no Google, clique no ícone verde "Vincular ao Planilhas" e cole aqui o link da planilha gerada.',
        },
      }));
      return;
    }

    setTestingSource(source);
    try {
      const csvText = await fetchCsvWithTimeout(url.trim(), 14000);
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
            message: `Conexão bem-sucedida! ${count.toLocaleString('pt-BR')} locais carregados da aba selecionada (${imp} urnas implantadas, ${desmob} desmobilizadas).`,
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
            message: `Conexão bem-sucedida! ${count} ocorrência(s) do 2º Turno encontrada(s) (${tipoDet}).`,
          },
        }));
        return;
      } else if (source === 'faltas') {
        const parsed = parseFaltasCsv(csvText);
        count = parsed.length;
        onFaltasUpdated(parsed);
        CsvHelper.saveFaltas(parsed);
        CsvHelper.setFaltasSheetUrl(url.trim());
        if (onVerificacaoUpdated) {
          onVerificacaoUpdated(parsed);
        }
        CsvHelper.saveVerificacao(parsed);
        CsvHelper.setVerificacaoSheetUrl(url.trim());
        setTestResult((prev) => ({
          ...prev,
          [source]: {
            success: true,
            message: `Conexão bem-sucedida! ${count} registro(s) de faltas do 2º Turno carregado(s) e sincronizado(s) em ambas as abas.`,
          },
        }));
        return;
      } else if (source === 'verificacao') {
        const parsed = parseFaltasCsv(csvText);
        count = parsed.length;
        if (onVerificacaoUpdated) {
          onVerificacaoUpdated(parsed);
        }
        CsvHelper.saveVerificacao(parsed);
        CsvHelper.setVerificacaoSheetUrl(url.trim());
        onFaltasUpdated(parsed);
        CsvHelper.saveFaltas(parsed);
        CsvHelper.setFaltasSheetUrl(url.trim());
        setTestResult((prev) => ({
          ...prev,
          [source]: {
            success: true,
            message: `Conexão bem-sucedida! ${count} registro(s) depurado(s) carregado(s) e sincronizado(s) com a Aba de Faltas.`,
          },
        }));
        return;
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      let friendlyMsg = 'Falha ao acessar link. Verifique se a planilha está compartilhada com permissão de leitura.';
      if (errMsg.includes('RESTRICTED') || errMsg.includes('Restrito')) {
        friendlyMsg = 'Acesso restrito no Google Drive. Na sua planilha do Google, clique no botão azul "Compartilhar" (topo direito), mude o Acesso Geral para "Qualquer pessoa com o link" (Leitor) e salve novamente.';
      } else if (errMsg.includes('404')) {
        friendlyMsg = 'Planilha não encontrada (Erro 404). Verifique o endereço digitado.';
      }
      setTestResult((prev) => ({
        ...prev,
        [source]: {
          success: false,
          message: friendlyMsg,
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
                message: `Arquivo importado: ${parsed.length.toLocaleString('pt-BR')} locais carregados!`,
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
                message: `Arquivo importado: ${parsed.length} ocorrências do 2º Turno carregadas!`,
              },
            }));
          }
        } else if (source === 'faltas') {
          const parsed = parseFaltasCsv(text);
          if (parsed.length > 0) {
            onFaltasUpdated(parsed);
            CsvHelper.saveFaltas(parsed);
            if (onVerificacaoUpdated) {
              onVerificacaoUpdated(parsed);
            }
            CsvHelper.saveVerificacao(parsed);
            setTestResult((prev) => ({
              ...prev,
              [source]: {
                success: true,
                message: `Arquivo importado: ${parsed.length} registros de faltas do 2º Turno carregados e sincronizados!`,
              },
            }));
          }
        }
      } catch (err: any) {
        setTestResult((prev) => ({
          ...prev,
          [source]: { success: false, message: `Erro ao ler arquivo: ${err?.message}` },
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
              <h2 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                <span>Links & Planilhas Oficiais (2º Turno)</span>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  Persistência Permanente no Servidor
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie os links das planilhas Google do 2º Turno ou importe arquivos CSV locais
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Banner de Fixação Efetiva no Sistema */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs text-emerald-950 shadow-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold text-emerald-900 block uppercase tracking-wide text-[11px]">
                  Persistência Central no Servidor Ativa
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Os links e dados são salvos em arquivos dedicados no servidor central. Ao salvar abaixo, a configuração é fixada permanentemente para todos os aparelhos e navegadores.
                </p>
              </div>
            </div>

            {/* Botão de Limpeza dos Caches do 1º Turno */}
            <button
              type="button"
              onClick={handleClearCacheAndReset}
              disabled={isClearing}
              className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-[11px] flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
              title="Remove registros do 1º turno (87 ocorrências) e redefine para 1 dado de teste do 2º turno"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-700" />
              <span>{isClearing ? 'Limpando...' : 'Limpar Caches do 1º Turno'}</span>
            </button>
          </div>

          {clearSuccessMsg && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{clearSuccessMsg}</span>
            </div>
          )}

          {/* 1. Locais de Votação (Aba 2º Turno) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>1. Planilha de Locais de Votação (Aba do 2º Turno)</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Mesma planilha do Google com a aba do 2º Turno (ex: cole o link completo com o <code className="bg-slate-200 px-1 rounded text-slate-700 font-mono">#gid=...</code> da nova aba)
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
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=NOVO_GID_2_TURNO"
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

          {/* 2. Ocorrências (2º Turno Oficial) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>2. Planilha de Respostas de Ocorrências (2º Turno)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">Nova Planilha</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Respostas do novo Formulário Google de Ocorrências (atualmente com 1 registro de teste enviado)
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
                placeholder="Cole o novo link do Google Sheets de Ocorrências do 2º Turno..."
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

          {/* 3. Faltas de Efetivo POE (2º Turno Oficial) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>3. Planilha de Respostas de Faltas no POE (2º Turno)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">Nova Planilha</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Respostas do novo Formulário Google de Faltas no POE (atualmente com 1 registro de teste enviado)
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
                placeholder="Cole o novo link do Google Sheets de Faltas do 2º Turno..."
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
            Fixação permanente no servidor para todos os navegadores e celulares.
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
