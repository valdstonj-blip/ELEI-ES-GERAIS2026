import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';
import {
  parseLocaisCsv,
  parseOcorrenciasCsv,
  parseFaltasCsv,
  fetchCsvWithTimeout as fetchGoogleSheetCsv,
} from '../services/sheetService';
import { RAW_PLANILHA_GERAL_DASH_CSV } from '../data/locaisComprehensiveData';
import { INITIAL_OCORRENCIAS, INITIAL_FALTAS } from '../data/mockData';

// Link oficial fixo da Planilha Geral Dash passado pelo operador EMG-PM/3
export const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1j6fAH3lpWLf29B17vYmzz3O6DRtmsyCbA3eiFxCGjkw/edit?gid=907029771#gid=907029771';

export const DEFAULT_OCORRENCIAS_URL =
  'https://docs.google.com/spreadsheets/d/1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE/edit?gid=2054351637#gid=2054351637';

export const DEFAULT_FALTAS_URL =
  'https://docs.google.com/spreadsheets/d/1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8/edit?gid=613414577#gid=613414577';

export const SHEET_URLS = {
  PLANILHA_1_LOCAIS: DEFAULT_SHEET_URL,
  PLANILHA_2_OCORRENCIAS: DEFAULT_OCORRENCIAS_URL,
  PLANILHA_3_FALTAS: DEFAULT_FALTAS_URL,
};

const STORAGE_KEYS = {
  LOCAIS: 'eleicoes2026_csv_locais_v7_faithful_live_sheet',
  OCORRENCIAS: 'eleicoes2026_csv_ocorrencias_v6_clean',
  FALTAS: 'eleicoes2026_csv_faltas_v6_clean',
  LAST_SYNC: 'eleicoes2026_csv_last_sync_v6',
  LOCAIS_URL: 'eleicoes2026_custom_locais_sheet_url_v2',
  OCORRENCIAS_URL: 'eleicoes2026_custom_ocorrencias_sheet_url_v2',
  FALTAS_URL: 'eleicoes2026_custom_faltas_sheet_url_v2',
};

const LEGACY_LOCAIS_URL_KEYS = [
  'eleicoes2026_custom_locais_sheet_url_v2',
  'eleicoes2026_locais_sheet_url',
  'eleicoes2026_locais_url',
  'eleicoes2026_planilha_locais_url',
  'eleicoes2026_sheet_locais',
];

const LEGACY_OCORRENCIAS_URL_KEYS = [
  'eleicoes2026_custom_ocorrencias_sheet_url_v2',
  'eleicoes2026_custom_ocorrencias_sheet_url',
  'eleicoes2026_ocorrencias_sheet_url',
  'eleicoes2026_ocorrencias_url',
  'eleicoes2026_planilha_ocorrencias_url',
  'eleicoes2026_sheet_ocorrencias',
];

const LEGACY_FALTAS_URL_KEYS = [
  'eleicoes2026_custom_faltas_sheet_url_v2',
  'eleicoes2026_custom_faltas_sheet_url',
  'eleicoes2026_faltas_sheet_url',
  'eleicoes2026_faltas_url',
  'eleicoes2026_planilha_faltas_url',
  'eleicoes2026_sheet_faltas',
];

// Envia configuração atualizada para o servidor para que todos os aparelhos sincronizem
function pushConfigToServer(partial: { locaisUrl?: string; ocorrenciasUrl?: string; faltasUrl?: string }) {
  try {
    fetch('/api/sheet-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    }).catch(() => {});
  } catch {}
}

export const CsvHelper = {
  // Inicialização e sincronização mútua e permanente (localStorage <-> backend)
  async initAndSyncUrls(): Promise<{ locaisUrl: string; ocorrenciasUrl: string; faltasUrl: string }> {
    // 1. Carrega imediatamente do localStorage para inicialização instantânea
    const localLocais = this.getLocaisSheetUrl();
    const localOcorr = this.getOcorrenciasSheetUrl();
    const localFaltas = this.getFaltasSheetUrl();

    if (localLocais) SHEET_URLS.PLANILHA_1_LOCAIS = localLocais;
    if (localOcorr) SHEET_URLS.PLANILHA_2_OCORRENCIAS = localOcorr;
    if (localFaltas) SHEET_URLS.PLANILHA_3_FALTAS = localFaltas;

    // 2. Consulta o backend central para sincronização cruzada entre dispositivos e navegadores
    try {
      const res = await fetch('/api/sheet-config');
      if (res.ok) {
        const serverConfig = await res.json();
        let needPush = false;
        const pushPayload: any = {};

        // Sincroniza Locais
        if (serverConfig.locaisUrl && typeof serverConfig.locaisUrl === 'string' && serverConfig.locaisUrl.startsWith('http')) {
          if (!localLocais || localLocais === DEFAULT_SHEET_URL) {
            this.setLocaisSheetUrl(serverConfig.locaisUrl, false);
          } else if (localLocais && localLocais !== serverConfig.locaisUrl && localLocais !== DEFAULT_SHEET_URL) {
            // O cliente local tem uma URL configurada que difere do servidor: envia ao servidor
            pushPayload.locaisUrl = localLocais;
            needPush = true;
          }
        } else if (localLocais && localLocais.startsWith('http')) {
          pushPayload.locaisUrl = localLocais;
          needPush = true;
        }

        // Sincroniza Ocorrências
        if (serverConfig.ocorrenciasUrl && typeof serverConfig.ocorrenciasUrl === 'string' && serverConfig.ocorrenciasUrl.startsWith('http')) {
          this.setOcorrenciasSheetUrl(serverConfig.ocorrenciasUrl, false);
        } else if (localOcorr && localOcorr.startsWith('http')) {
          pushPayload.ocorrenciasUrl = localOcorr;
          needPush = true;
        }

        // Sincroniza Faltas
        if (serverConfig.faltasUrl && typeof serverConfig.faltasUrl === 'string' && serverConfig.faltasUrl.startsWith('http')) {
          this.setFaltasSheetUrl(serverConfig.faltasUrl, false);
        } else if (localFaltas && localFaltas.startsWith('http')) {
          pushPayload.faltasUrl = localFaltas;
          needPush = true;
        }

        if (needPush) {
          pushConfigToServer(pushPayload);
        }
      }
    } catch (e) {
      console.warn('Backend offline ou em modo offline local:', e);
    }

    return {
      locaisUrl: this.getLocaisSheetUrl(),
      ocorrenciasUrl: this.getOcorrenciasSheetUrl(),
      faltasUrl: this.getFaltasSheetUrl(),
    };
  },

  // Alias retrocompatível
  async syncWithServer(): Promise<{ locaisUrl: string; ocorrenciasUrl: string; faltasUrl: string }> {
    return this.initAndSyncUrls();
  },

  // Salva simultaneamente em memória, em todas as chaves do localStorage e no servidor central
  async saveAllSheetUrls(urls: {
    locaisUrl?: string;
    ocorrenciasUrl?: string;
    faltasUrl?: string;
  }): Promise<boolean> {
    const cleanLocais = urls.locaisUrl !== undefined ? urls.locaisUrl.trim() : this.getLocaisSheetUrl();
    const cleanOcorr = urls.ocorrenciasUrl !== undefined ? urls.ocorrenciasUrl.trim() : this.getOcorrenciasSheetUrl();
    const cleanFaltas = urls.faltasUrl !== undefined ? urls.faltasUrl.trim() : this.getFaltasSheetUrl();

    this.setLocaisSheetUrl(cleanLocais, false);
    this.setOcorrenciasSheetUrl(cleanOcorr, false);
    this.setFaltasSheetUrl(cleanFaltas, false);

    try {
      const res = await fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locaisUrl: cleanLocais,
          ocorrenciasUrl: cleanOcorr,
          faltasUrl: cleanFaltas,
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Erro ao salvar no servidor:', err);
      return false;
    }
  },

  getLocaisSheetUrl(): string {
    for (const k of LEGACY_LOCAIS_URL_KEYS) {
      try {
        const val = localStorage.getItem(k);
        if (val && val.trim().startsWith('http')) {
          SHEET_URLS.PLANILHA_1_LOCAIS = val.trim();
          return val.trim();
        }
      } catch {}
    }

    if (SHEET_URLS.PLANILHA_1_LOCAIS && SHEET_URLS.PLANILHA_1_LOCAIS.trim().startsWith('http')) {
      return SHEET_URLS.PLANILHA_1_LOCAIS.trim();
    }
    return DEFAULT_SHEET_URL;
  },

  setLocaisSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      LEGACY_LOCAIS_URL_KEYS.forEach((k) => {
        try {
          localStorage.setItem(k, clean);
        } catch {}
      });
      SHEET_URLS.PLANILHA_1_LOCAIS = clean;
      if (pushToServer) pushConfigToServer({ locaisUrl: clean });
    } else {
      LEGACY_LOCAIS_URL_KEYS.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      SHEET_URLS.PLANILHA_1_LOCAIS = '';
      if (pushToServer) pushConfigToServer({ locaisUrl: '' });
    }
  },

  getOcorrenciasSheetUrl(): string {
    for (const k of LEGACY_OCORRENCIAS_URL_KEYS) {
      try {
        const val = localStorage.getItem(k);
        if (val && val.trim().startsWith('http')) {
          SHEET_URLS.PLANILHA_2_OCORRENCIAS = val.trim();
          return val.trim();
        }
      } catch {}
    }

    if (SHEET_URLS.PLANILHA_2_OCORRENCIAS && SHEET_URLS.PLANILHA_2_OCORRENCIAS.trim().startsWith('http')) {
      return SHEET_URLS.PLANILHA_2_OCORRENCIAS.trim();
    }

    return DEFAULT_OCORRENCIAS_URL;
  },

  setOcorrenciasSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      LEGACY_OCORRENCIAS_URL_KEYS.forEach((k) => {
        try {
          localStorage.setItem(k, clean);
        } catch {}
      });
      SHEET_URLS.PLANILHA_2_OCORRENCIAS = clean;
      if (pushToServer) pushConfigToServer({ ocorrenciasUrl: clean });
    } else {
      LEGACY_OCORRENCIAS_URL_KEYS.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      SHEET_URLS.PLANILHA_2_OCORRENCIAS = '';
      if (pushToServer) pushConfigToServer({ ocorrenciasUrl: '' });
    }
  },

  getFaltasSheetUrl(): string {
    for (const k of LEGACY_FALTAS_URL_KEYS) {
      try {
        const val = localStorage.getItem(k);
        if (val && val.trim().startsWith('http')) {
          SHEET_URLS.PLANILHA_3_FALTAS = val.trim();
          return val.trim();
        }
      } catch {}
    }

    if (SHEET_URLS.PLANILHA_3_FALTAS && SHEET_URLS.PLANILHA_3_FALTAS.trim().startsWith('http')) {
      return SHEET_URLS.PLANILHA_3_FALTAS.trim();
    }

    return DEFAULT_FALTAS_URL;
  },

  setFaltasSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      LEGACY_FALTAS_URL_KEYS.forEach((k) => {
        try {
          localStorage.setItem(k, clean);
        } catch {}
      });
      SHEET_URLS.PLANILHA_3_FALTAS = clean;
      if (pushToServer) pushConfigToServer({ faltasUrl: clean });
    } else {
      LEGACY_FALTAS_URL_KEYS.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      SHEET_URLS.PLANILHA_3_FALTAS = '';
      if (pushToServer) pushConfigToServer({ faltasUrl: '' });
    }
  },

  // 1. Locais de Votação (Planilha Geral Dash)
  getStoredLocais(): LocalVotacao[] {
    try {
      // Remove qualquer cache corrompido que continha as 6 urnas e 4 desmobilizadas hardcoded
      localStorage.removeItem('eleicoes2026_csv_locais_v5102_cpp_sync_6_imp_4_desmob');
      localStorage.removeItem('eleicoes2026_locais_cache_v5103_faithful_v4');

      const raw = localStorage.getItem(STORAGE_KEYS.LOCAIS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 5000) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler locais salvos no cache:', e);
    }

    // Inicialização limpa: todos os 5.102 locais com implantada=false e desmobilizada=false
    const initial = parseLocaisCsv(RAW_PLANILHA_GERAL_DASH_CSV);
    const cleanInitial = initial.map((l) => ({
      ...l,
      implantada: false,
      desmobilizada: false,
    }));
    this.saveLocais(cleanInitial);
    return cleanInitial;
  },

  saveLocais(data: LocalVotacao[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAIS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar locais no localStorage:', e);
    }

    try {
      fetch('/api/locais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locais: data }),
      }).catch(() => {});
    } catch {}
  },

  async fetchServerLocais(): Promise<LocalVotacao[] | null> {
    try {
      const res = await fetch('/api/locais');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.locais) && json.locais.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.LOCAIS, JSON.stringify(json.locais));
          } catch {}
          return json.locais;
        }
      }
    } catch {}
    return null;
  },

  // 2. Ocorrências (sem dados artificiais ou mocks)
  getStoredOcorrencias(): Ocorrencia[] {
    const isMock = (o: any) => {
      const s = `${o?.local || ''} ${o?.dinamica || ''} ${o?.bopm || ''} ${o?.ro || ''}`.toLowerCase();
      return (
        s.includes('edgard romero') ||
        s.includes('009-1425/26') ||
        s.includes('029-03145/2026') ||
        s.includes('vidro da janela')
      );
    };

    const keysToTry = [
      STORAGE_KEYS.OCORRENCIAS,
      'eleicoes2026_csv_ocorrencias_v5_dano_1reg',
      'eleicoes2026_csv_ocorrencias',
      'eleicoes2026_csv_ocorrencias_v4',
      'eleicoes2026_csv_ocorrencias_v3',
      'eleicoes2026_csv_ocorrencias_v2',
      'eleicoes2026_csv_ocorrencias_v1',
      'eleicoes2026_ocorrencias_cache_v2',
      'eleicoes2026_ocorrencias_cache',
    ];

    for (const key of keysToTry) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter((o) => !isMock(o));
            if (clean.length > 0) {
              this.saveOcorrencias(clean);
              return clean;
            }
          }
        }
      } catch (e) {
        console.warn(`Falha ao ler cache na chave ${key}:`, e);
      }
    }

    // Se não há dados no cache, inicializa com INITIAL_OCORRENCIAS para cold start imediato
    this.saveOcorrencias(INITIAL_OCORRENCIAS);
    return INITIAL_OCORRENCIAS;
  },

  saveOcorrencias(data: Ocorrencia[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.OCORRENCIAS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar ocorrencias no localStorage:', e);
    }
  },

  // 3. Faltas de Efetivo
  getStoredFaltas(): FaltaEfetivo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FALTAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler faltas do cache:', e);
    }
    this.saveFaltas(INITIAL_FALTAS);
    return INITIAL_FALTAS;
  },

  saveFaltas(data: FaltaEfetivo[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.FALTAS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar faltas no localStorage:', e);
    }
  },

  // Registro de Carimbo de Sincronização
  getLastSyncTime(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  },

  setLastSyncTime(timestamp: string) {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  },
};

export const fetchCsvWithTimeout = fetchGoogleSheetCsv;
