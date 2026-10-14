import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LocalVotacao,
  Ocorrencia,
  FaltaEfetivo,
  ActiveTab,
} from './types';
import {
  DEFAULT_SHEET_URL,
  CsvHelper,
  fetchCsvWithTimeout,
} from './lib/csvHelper';
import {
  parseLocaisCsv,
  parseOcorrenciasCsv,
  parseFaltasCsv,
  isSim,
} from './services/sheetService';
import { matchesCarimboDate } from './services/pdfService';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LocaisTab } from './components/LocaisTab';
import { OcorrenciasTab } from './components/OcorrenciasTab';
import { FaltasTab } from './components/FaltasTab';
import { VerificacaoTab } from './components/VerificacaoTab';
import { SheetConnectionModal } from './components/SheetConnectionModal';
import { runFaltasAudit } from './services/faltasAuditService';

export default function App() {
  // Autenticação e perfil de acesso ('admin' tem acesso a links/configurações; 'pm3' apenas visualiza)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('eleicoes2026_auth') === 'true';
  });
  const [userRole, setUserRole] = useState<string>(() => {
    return localStorage.getItem('eleicoes2026_role') || 'admin';
  });
  const isAdmin = userRole === 'admin';

  // Aba ativa de navegação direta no topo
  const [activeTab, setActiveTab] = useState<ActiveTab>('locais');

  // Modal de conexão e configuração de links
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState<boolean>(false);

  // Carregamento instantâneo via cache em localStorage (Cold Start imediato garantido)
  const [locais, setLocais] = useState<LocalVotacao[]>(() => CsvHelper.getStoredLocais());
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(() => CsvHelper.getStoredOcorrencias());
  const [faltas, setFaltas] = useState<FaltaEfetivo[]>(() => CsvHelper.getStoredFaltas());
  const [faltasVerificadas, setFaltasVerificadas] = useState<FaltaEfetivo[]>(() => CsvHelper.getStoredVerificacao());

  // Estado de sincronização em segundo plano
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return CsvHelper.getLastSyncTime() || new Date().toLocaleTimeString('pt-BR');
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  /**
   * Sincronização direta com as 3 Planilhas Google Sheets em paralelo
   * - Executa as 3 requisições de forma simultânea (Promise.allSettled)
   * - Nunca bloqueia uma base se a outra estiver lenta
   */
  const syncData = useCallback(async (silent = false) => {
    setIsSyncing(true);
    let updatedSources = 0;
    let detalhes = '';
    let errorMessage = '';

    try {
      const tasks: Promise<void>[] = [];

      // 1. Locais de Votação (Planilha Geral Dash)
      const locaisTask = (async () => {
        const targetUrl = CsvHelper.getLocaisSheetUrl() || DEFAULT_SHEET_URL;
        try {
          const csvText = await fetchCsvWithTimeout(targetUrl);
          const parsed = parseLocaisCsv(csvText);
          if (parsed && parsed.length > 0) {
            setLocais(parsed);
            CsvHelper.saveLocais(parsed);
            updatedSources++;
            const imp = parsed.filter((l) => isSim(l.implantada)).length;
            const desm = parsed.filter((l) => isSim(l.desmobilizada)).length;
            detalhes = `${parsed.length.toLocaleString('pt-BR')} locais (${imp} urnas implantadas, ${desm} desmobilizadas)`;
          }
        } catch (err: any) {
          console.warn('Aviso sincronização remota locais:', err);
          if (err?.message?.includes('404')) {
            errorMessage = 'O link de Locais retornou Erro 404 no Google.';
          } else if (err?.message?.includes('Restrito') || err?.message?.includes('login') || err?.message?.includes('HTML')) {
            errorMessage = 'Planilha de Locais com acesso restrito no Google Drive. No Google Sheets, marque "Qualquer pessoa com o link" (Leitor).';
          }
        }
      })();
      tasks.push(locaisTask);

      // 2. Ocorrências (Planilha de Respostas do Formulário)
      const ocorrenciasTask = (async () => {
        const ocorrenciasUrl = CsvHelper.getOcorrenciasSheetUrl();
        if (ocorrenciasUrl && ocorrenciasUrl.startsWith('http')) {
          try {
            const csvText = await fetchCsvWithTimeout(ocorrenciasUrl);
            const parsed = parseOcorrenciasCsv(csvText);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setOcorrencias(parsed);
              CsvHelper.saveOcorrencias(parsed);
              updatedSources++;
            }
          } catch (err: any) {
            console.warn('Erro ao atualizar Planilha de Ocorrências:', err);
          }
        }
      })();
      tasks.push(ocorrenciasTask);

      // 3. Faltas de Efetivo (Planilha de Respostas do Formulário POE)
      const faltasTask = (async () => {
        const faltasUrl = CsvHelper.getFaltasSheetUrl();
        if (faltasUrl && faltasUrl.startsWith('http')) {
          try {
            const csvText = await fetchCsvWithTimeout(faltasUrl);
            const parsed = parseFaltasCsv(csvText);
            if (parsed && parsed.length > 0) {
              setFaltas(parsed);
              CsvHelper.saveFaltas(parsed);
              updatedSources++;
            }
          } catch (err: any) {
            console.warn('Erro ao atualizar Planilha de Faltas:', err);
          }
        }
      })();
      tasks.push(faltasTask);

      // 4. Verificação de Faltas (Dados Depurados)
      const verificacaoTask = (async () => {
        const verifUrl = CsvHelper.getVerificacaoSheetUrl();
        if (verifUrl && verifUrl.startsWith('http')) {
          try {
            const csvText = await fetchCsvWithTimeout(verifUrl);
            const parsed = parseFaltasCsv(csvText);
            if (parsed && parsed.length > 0) {
              setFaltasVerificadas(parsed);
              CsvHelper.saveVerificacao(parsed);
              updatedSources++;
            }
          } catch (err: any) {
            console.warn('Erro ao atualizar Planilha de Verificação:', err);
          }
        }
      })();
      tasks.push(verificacaoTask);

      await Promise.allSettled(tasks);

      const nowStr = new Date().toLocaleTimeString('pt-BR');
      setLastSyncTime(nowStr);
      CsvHelper.setLastSyncTime(nowStr);

      if (!silent) {
        if (updatedSources > 0) {
          showToast(`Sincronização concluída às ${nowStr}! ${detalhes ? `• ${detalhes}` : ''}`, 'success');
        } else if (errorMessage) {
          showToast(errorMessage, 'error');
        } else {
          showToast(`Sincronização verificada às ${nowStr}. Dados operacionais mantidos.`, 'info');
        }
      }
    } catch (globalError: any) {
      console.error('Falha na sincronização:', globalError);
      if (!silent) showToast('Falha de conexão. Dados mantidos em segurança.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Sincronização inicial automática dos links e bases ao abrir em qualquer dispositivo ou navegador
  useEffect(() => {
    let isMounted = true;

    // 1. Carrega dados persistidos do servidor central (computadores e celulares)
    CsvHelper.fetchServerLocais().then((serverLocais) => {
      if (isMounted && serverLocais && serverLocais.length > 0) {
        setLocais(serverLocais);
      }
    });

    CsvHelper.fetchServerOcorrencias().then((serverOcorr) => {
      if (isMounted && serverOcorr && serverOcorr.length > 0) {
        setOcorrencias(serverOcorr);
      }
    });

    CsvHelper.fetchServerFaltas().then((serverFaltas) => {
      if (isMounted && serverFaltas && serverFaltas.length > 0) {
        setFaltas(serverFaltas);
        setFaltasVerificadas((prev) => (prev.length === 0 ? serverFaltas : prev));
      }
    });

    CsvHelper.fetchServerVerificacao().then((serverVerif) => {
      if (isMounted && serverVerif && serverVerif.length > 0) {
        setFaltasVerificadas(serverVerif);
        setFaltas((prev) => (prev.length === 0 ? serverVerif : prev));
      }
    });

    CsvHelper.initAndSyncUrls().then((urls) => {
      if (isMounted) {
        console.log('[EMG-PM/3] Links permanentes inicializados com sucesso:', urls);
        syncData(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [syncData]);

  // Se uma das bases possuir dados e a outra estiver vazia, sincroniza-as imediatamente
  useEffect(() => {
    if (faltas.length > 0 && faltasVerificadas.length === 0) {
      setFaltasVerificadas(faltas);
      CsvHelper.saveVerificacao(faltas);
    } else if (faltasVerificadas.length > 0 && faltas.length === 0) {
      setFaltas(faltasVerificadas);
      CsvHelper.saveFaltas(faltasVerificadas);
    }
  }, [faltas.length, faltasVerificadas.length]);

  // Auto-refresh silencioso em segundo plano a cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      syncData(true);
    }, 60000);

    return () => clearInterval(timer);
  }, [syncData]);

  // Registro manual de ocorrência
  const handleAddOcorrencia = (nova: Ocorrencia) => {
    const updated = [nova, ...ocorrencias];
    setOcorrencias(updated);
    CsvHelper.saveOcorrencias(updated);
    showToast('Ocorrência registrada com sucesso!', 'success');
  };

  // Registro manual de falta
  const handleAddFalta = (nova: FaltaEfetivo) => {
    const updated = [nova, ...faltas];
    setFaltas(updated);
    setFaltasVerificadas(updated);
    CsvHelper.saveFaltas(updated);
    CsvHelper.saveVerificacao(updated);
    showToast('Falta de efetivo registrada com sucesso!', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('eleicoes2026_auth');
    localStorage.removeItem('eleicoes2026_role');
    setIsAuthenticated(false);
    setUserRole('admin');
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          setUserRole(localStorage.getItem('eleicoes2026_role') || 'admin');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 border-emerald-700 text-white'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 border-rose-700 text-white'
              : 'bg-blue-900 border-blue-700 text-white'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Contagens do 2º Turno Oficial */}
      {(() => {
        const countOcorrencias2oTurno = ocorrencias.length;
        const countFaltas2oTurno = faltas.length;

        return (
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            onManualSync={() => syncData(false)}
            onLogout={handleLogout}
            onOpenSettings={isAdmin ? () => setIsConnectionModalOpen(true) : undefined}
            isAdmin={isAdmin}
            userRole={userRole}
            counts={{
              locais: locais.length,
              ocorrencias: countOcorrencias2oTurno,
              faltas: countFaltas2oTurno,
              verificacao: faltasVerificadas.length || countFaltas2oTurno,
              sensiveis: locais.filter((l) => isSim(l.areaSensivel)).length,
              inconsistencias: faltasVerificadas.length || countFaltas2oTurno,
            }}
          />
        );
      })()}

      {/* Modal de Conexão com Google Sheets & Importação de CSV (Apenas Admin) */}
      {isAdmin && (
        <SheetConnectionModal
          isOpen={isConnectionModalOpen}
          onClose={() => setIsConnectionModalOpen(false)}
          onLocaisUpdated={(data) => {
            setLocais(data);
            showToast(`${data.length.toLocaleString('pt-BR')} locais de votação atualizados com sucesso!`, 'success');
          }}
          onOcorrenciasUpdated={(data) => {
            setOcorrencias(data);
            showToast(`${data.length} ocorrências atualizadas com sucesso!`, 'success');
          }}
          onFaltasUpdated={(data) => {
            setFaltas(data);
            setFaltasVerificadas(data);
            showToast(`${data.length} registros de faltas/efetivo atualizados com sucesso!`, 'success');
          }}
          onVerificacaoUpdated={(data) => {
            setFaltasVerificadas(data);
            setFaltas(data);
          }}
          onSyncAll={() => {
            syncData(false);
            showToast('Links gravados no servidor e bases sincronizadas com sucesso!', 'success');
          }}
          onReset2Turno={() => {
            setOcorrencias(CsvHelper.getStoredOcorrencias());
            setFaltas(CsvHelper.getStoredFaltas());
            setFaltasVerificadas(CsvHelper.getStoredVerificacao());
            showToast('Caches purgados e sistema redefinido para o 2º Turno Oficial!', 'success');
          }}
        />
      )}

      {/* Corpo da Aplicação Responsivo */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-4 py-3 sm:py-4 flex-1 w-full">
        {activeTab === 'locais' && (
          <LocaisTab
            locais={locais}
            onUpdateLocais={(updated) => {
              setLocais(updated);
              CsvHelper.saveLocais(updated);
            }}
            onSync={() => syncData(false)}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === 'ocorrencias' && (
          <OcorrenciasTab
            ocorrencias={ocorrencias}
            onAddOcorrencia={handleAddOcorrencia}
            lastSyncTime={lastSyncTime}
            onSync={() => syncData(false)}
            isSyncing={isSyncing}
            onOpenSettings={isAdmin ? () => setIsConnectionModalOpen(true) : undefined}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'faltas' && (
          <FaltasTab
            faltas={faltas}
            onAddFalta={handleAddFalta}
            lastSyncTime={lastSyncTime}
            onSync={() => syncData(false)}
            isSyncing={isSyncing}
            onOpenSettings={isAdmin ? () => setIsConnectionModalOpen(true) : undefined}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'verificacao' && (
          <VerificacaoTab
            faltas={faltasVerificadas}
            onUpdateFaltas={(data) => {
              setFaltasVerificadas(data);
              CsvHelper.saveVerificacao(data);
              setFaltas(data);
              CsvHelper.saveFaltas(data);
            }}
            lastSyncTime={lastSyncTime}
            onSync={() => syncData(false)}
            isSyncing={isSyncing}
            isAdmin={isAdmin}
          />
        )}
      </main>

      {/* Rodapé Oficial da Seção de Planejamento */}
      <Footer />
    </div>
  );
}
