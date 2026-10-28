import { LocalVotacao, Ocorrencia, FaltaEfetivo } from '../types';
import {
  parseLocaisCsv,
  parseOcorrenciasCsv,
  parseFaltasCsv,
  fetchCsvWithTimeout as fetchGoogleSheetCsv,
} from '../services/sheetService';
import { RAW_PLANILHA_GERAL_DASH_CSV } from '../data/locaisComprehensiveData';
import { RAW_FALTAS_CSV } from '../data/rawFaltasCsv';
import { RAW_VERIFICACAO_CSV } from '../data/rawVerificacaoCsv';
import { INITIAL_OCORRENCIAS, INITIAL_FALTAS } from '../data/mockData';

// Link oficial da Planilha de Locais de Votação (suporta qualquer aba GID que o operador configurar)
export const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1j6fAH3lpWLf29B17vYmzz3O6DRtmsyCbA3eiFxCGjkw/edit';

// URLs oficiais do 2º Turno Oficial
export const DEFAULT_OCORRENCIAS_URL =
  'https://docs.google.com/spreadsheets/d/1mjwbWLqU3rpnMtyHyKJzqj1u0cKrb3Hdx-Rx2BBNkGc/edit?gid=1689465461#gid=1689465461';
export const DEFAULT_FALTAS_URL =
  'https://docs.google.com/spreadsheets/d/1AyyegbNXdVKuo1zeuvh-MemyWfkaxUNuqxwbHtPX4p4/edit?gid=298390191#gid=298390191';
export const DEFAULT_VERIFICACAO_URL =
  'https://docs.google.com/spreadsheets/d/1AyyegbNXdVKuo1zeuvh-MemyWfkaxUNuqxwbHtPX4p4/edit?gid=298390191#gid=298390191';
export const DEFAULT_CONTROLE_URL =
  'https://docs.google.com/spreadsheets/d/1mFNqir2Y3Dwxt2WKQDMhCgfp2CgS1pFGfR_o5cwpw_w/edit?gid=0#gid=0';

export const SHEET_URLS = {
  PLANILHA_1_LOCAIS: DEFAULT_SHEET_URL,
  PLANILHA_2_OCORRENCIAS: DEFAULT_OCORRENCIAS_URL,
  PLANILHA_3_FALTAS: DEFAULT_FALTAS_URL,
  PLANILHA_4_VERIFICACAO: DEFAULT_VERIFICACAO_URL,
  PLANILHA_5_CONTROLE: DEFAULT_CONTROLE_URL,
};

export function parseControleStatus(text: string): 'LIBERADO' | 'BLOQUEADO' {
  if (!text) return 'LIBERADO';
  const clean = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (
    clean.includes('BLOQUEADO') ||
    clean.includes('BLOQUEAR') ||
    clean.includes('FECHADO') ||
    clean.includes('SUSPENSO') ||
    clean.includes('DESATIVADO')
  ) {
    return 'BLOQUEADO';
  }
  return 'LIBERADO';
}

const STORAGE_KEYS = {
  LOCAIS: 'eleicoes2026_csv_locais_v9_2turno',
  OCORRENCIAS: 'eleicoes2026_csv_ocorrencias_v9_2turno',
  FALTAS: 'eleicoes2026_csv_faltas_v9_2turno',
  VERIFICACAO: 'eleicoes2026_csv_verificacao_v9_2turno',
  LAST_SYNC: 'eleicoes2026_csv_last_sync_v9',
  LOCAIS_URL: 'eleicoes2026_custom_locais_url_v9',
  OCORRENCIAS_URL: 'eleicoes2026_custom_ocorrencias_url_v9',
  FALTAS_URL: 'eleicoes2026_custom_faltas_url_v9',
  VERIFICACAO_URL: 'eleicoes2026_custom_verificacao_url_v9',
  CONTROLE_URL: 'eleicoes2026_custom_controle_url_v1',
  CONTROLE_STATUS: 'eleicoes2026_controle_status_v1',
};

// Chaves antigas do 1º Turno a serem purgadas definitivamente do navegador
const OLD_KEYS_TO_PURGE = [
  'eleicoes2026_ocorrencias_cache_v2',
  'eleicoes2026_csv_ocorrencias_v8_2turno',
  'eleicoes2026_csv_ocorrencias_v7',
  'eleicoes2026_faltas_cache',
  'eleicoes2026_csv_faltas_v8_2turno',
  'eleicoes2026_csv_faltas_v7',
  'eleicoes2026_csv_verificacao_v8_2turno',
  'eleicoes2026_config_cache',
  'eleicoes2026_custom_ocorrencias_sheet_url_v2',
  'eleicoes2026_custom_ocorrencias_sheet_url',
  'eleicoes2026_ocorrencias_sheet_url',
  'eleicoes2026_ocorrencias_url',
  'eleicoes2026_planilha_ocorrencias_url',
  'eleicoes2026_sheet_ocorrencias',
  'eleicoes2026_custom_faltas_sheet_url_v2',
  'eleicoes2026_custom_faltas_sheet_url',
  'eleicoes2026_faltas_sheet_url',
  'eleicoes2026_faltas_url',
  'eleicoes2026_planilha_faltas_url',
  'eleicoes2026_sheet_faltas',
  'eleicoes2026_csv_locais_v5102_cpp_sync_6_imp_4_desmob',
  'eleicoes2026_locais_cache_v5103_faithful_v4',
];

// Limpeza imediata no carregamento do módulo
try {
  OLD_KEYS_TO_PURGE.forEach((k) => {
    localStorage.removeItem(k);
  });
  // Purga imediata se o navegador ou celular armazenou a URL com gid 789471674 (137 faltas brutas)
  const stFaltasUrl = localStorage.getItem(STORAGE_KEYS.FALTAS_URL);
  if (stFaltasUrl && (stFaltasUrl.includes('789471674') || stFaltasUrl.includes('613414577') || stFaltasUrl.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8'))) {
    localStorage.removeItem(STORAGE_KEYS.FALTAS_URL);
    localStorage.removeItem(STORAGE_KEYS.FALTAS);
  }
  const stVerifUrl = localStorage.getItem(STORAGE_KEYS.VERIFICACAO_URL);
  if (stVerifUrl && (stVerifUrl.includes('789471674') || stVerifUrl.includes('613414577') || stVerifUrl.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8'))) {
    localStorage.removeItem(STORAGE_KEYS.VERIFICACAO_URL);
    localStorage.removeItem(STORAGE_KEYS.VERIFICACAO);
  }
  // Purga cache antigo de faltas caso tenha mais de 65 registros (o 2º turno depurado tem exatamente 65 registros = 125 faltas)
  const stFaltas = localStorage.getItem(STORAGE_KEYS.FALTAS);
  if (stFaltas) {
    const p = JSON.parse(stFaltas);
    if (Array.isArray(p) && p.length > 65) {
      localStorage.removeItem(STORAGE_KEYS.FALTAS);
      localStorage.removeItem(STORAGE_KEYS.VERIFICACAO);
    }
  }
} catch {}

function pushConfigToServer(partial: {
  locaisUrl?: string;
  ocorrenciasUrl?: string;
  faltasUrl?: string;
  verificacaoUrl?: string;
  controleUrl?: string;
  controleStatus?: string;
}) {
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
  async initAndSyncUrls(): Promise<{
    locaisUrl: string;
    ocorrenciasUrl: string;
    faltasUrl: string;
    verificacaoUrl: string;
    controleUrl: string;
    controleStatus: string;
  }> {
    // 1. Carrega do localStorage
    const localLocais = this.getLocaisSheetUrl();
    const localOcorr = this.getOcorrenciasSheetUrl();
    const localFaltas = this.getFaltasSheetUrl();
    const localVerif = this.getVerificacaoSheetUrl();
    const localControle = this.getControleSheetUrl();
    const localStatus = this.getControleStatus();

    if (localLocais) SHEET_URLS.PLANILHA_1_LOCAIS = localLocais;
    if (localOcorr) SHEET_URLS.PLANILHA_2_OCORRENCIAS = localOcorr;
    if (localFaltas) SHEET_URLS.PLANILHA_3_FALTAS = localFaltas;
    if (localVerif) SHEET_URLS.PLANILHA_4_VERIFICACAO = localVerif;
    if (localControle) SHEET_URLS.PLANILHA_5_CONTROLE = localControle;

    // 2. Consulta o backend central para sincronização persistente
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
          } else if (localLocais && localLocais !== serverConfig.locaisUrl) {
            pushPayload.locaisUrl = localLocais;
            needPush = true;
          }
        } else if (localLocais && localLocais.startsWith('http')) {
          pushPayload.locaisUrl = localLocais;
          needPush = true;
        }

        // Sincroniza Ocorrências (rejeita link do 1º turno)
        if (serverConfig.ocorrenciasUrl && typeof serverConfig.ocorrenciasUrl === 'string' && serverConfig.ocorrenciasUrl.startsWith('http') && !serverConfig.ocorrenciasUrl.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
          this.setOcorrenciasSheetUrl(serverConfig.ocorrenciasUrl, false);
        } else if (localOcorr && localOcorr.startsWith('http') && !localOcorr.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
          pushPayload.ocorrenciasUrl = localOcorr;
          needPush = true;
        } else {
          this.setOcorrenciasSheetUrl(DEFAULT_OCORRENCIAS_URL, true);
        }

        // Sincroniza Faltas (rejeita link do 1º turno e aba bruta 789471674 com 137 faltas)
        const isBadFaltasUrl = (u?: string | null) =>
          !u ||
          !u.startsWith('http') ||
          u.includes('613414577') ||
          u.includes('789471674') ||
          u.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8');

        if (serverConfig.faltasUrl && !isBadFaltasUrl(serverConfig.faltasUrl)) {
          this.setFaltasSheetUrl(serverConfig.faltasUrl, false);
        } else if (localFaltas && !isBadFaltasUrl(localFaltas)) {
          pushPayload.faltasUrl = localFaltas;
          needPush = true;
        } else {
          this.setFaltasSheetUrl(DEFAULT_FALTAS_URL, false);
          pushPayload.faltasUrl = DEFAULT_FALTAS_URL;
          needPush = true;
        }

        // Sincroniza Verificação (rejeita links antigos e abas brutas)
        if (serverConfig.verificacaoUrl && !isBadFaltasUrl(serverConfig.verificacaoUrl)) {
          this.setVerificacaoSheetUrl(serverConfig.verificacaoUrl, false);
        } else if (localVerif && !isBadFaltasUrl(localVerif)) {
          pushPayload.verificacaoUrl = localVerif;
          needPush = true;
        } else {
          this.setVerificacaoSheetUrl(DEFAULT_VERIFICACAO_URL, false);
          pushPayload.verificacaoUrl = DEFAULT_VERIFICACAO_URL;
          needPush = true;
        }

        // Sincroniza Controle de Acesso Remoto
        if (serverConfig.controleStatus) {
          try {
            localStorage.setItem(STORAGE_KEYS.CONTROLE_STATUS, serverConfig.controleStatus);
          } catch {}
        }
        if (serverConfig.controleUrl && typeof serverConfig.controleUrl === 'string' && serverConfig.controleUrl.startsWith('http')) {
          this.setControleSheetUrl(serverConfig.controleUrl, false);
        } else if (localControle && localControle.startsWith('http')) {
          pushPayload.controleUrl = localControle;
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
      verificacaoUrl: this.getVerificacaoSheetUrl(),
      controleUrl: this.getControleSheetUrl(),
      controleStatus: this.getControleStatus(),
    };
  },

  async syncWithServer(): Promise<{
    locaisUrl: string;
    ocorrenciasUrl: string;
    faltasUrl: string;
    verificacaoUrl: string;
    controleUrl: string;
    controleStatus: string;
  }> {
    return this.initAndSyncUrls();
  },

  // Salva simultaneamente em memória, no localStorage e no servidor central com persistência garantida
  async saveAllSheetUrls(urls: {
    locaisUrl?: string;
    ocorrenciasUrl?: string;
    faltasUrl?: string;
    verificacaoUrl?: string;
    controleUrl?: string;
    controleStatus?: 'LIBERADO' | 'BLOQUEADO';
  }): Promise<boolean> {
    const cleanLocais = urls.locaisUrl !== undefined ? urls.locaisUrl.trim() : this.getLocaisSheetUrl();
    const cleanOcorr = urls.ocorrenciasUrl !== undefined ? urls.ocorrenciasUrl.trim() : this.getOcorrenciasSheetUrl();
    const cleanFaltas = urls.faltasUrl !== undefined ? urls.faltasUrl.trim() : this.getFaltasSheetUrl();
    const cleanVerif = urls.verificacaoUrl !== undefined ? urls.verificacaoUrl.trim() : this.getVerificacaoSheetUrl();
    const cleanControle = urls.controleUrl !== undefined ? urls.controleUrl.trim() : this.getControleSheetUrl();
    const cleanStatus = urls.controleStatus || this.getControleStatus();

    this.setLocaisSheetUrl(cleanLocais, false);
    this.setOcorrenciasSheetUrl(cleanOcorr, false);
    this.setFaltasSheetUrl(cleanFaltas, false);
    this.setVerificacaoSheetUrl(cleanVerif, false);
    this.setControleSheetUrl(cleanControle, false);
    this.setControleStatus(cleanStatus, false);

    try {
      const res = await fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locaisUrl: cleanLocais,
          ocorrenciasUrl: cleanOcorr,
          faltasUrl: cleanFaltas,
          verificacaoUrl: cleanVerif,
          controleUrl: cleanControle,
          controleStatus: cleanStatus,
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Erro ao salvar no servidor:', err);
      return false;
    }
  },

  // --- Locais de Votação ---
  getLocaisSheetUrl(): string {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.LOCAIS_URL);
      if (val && val.trim().startsWith('http')) {
        SHEET_URLS.PLANILHA_1_LOCAIS = val.trim();
        return val.trim();
      }
    } catch {}

    if (SHEET_URLS.PLANILHA_1_LOCAIS && SHEET_URLS.PLANILHA_1_LOCAIS.trim().startsWith('http')) {
      return SHEET_URLS.PLANILHA_1_LOCAIS.trim();
    }
    return DEFAULT_SHEET_URL;
  },

  setLocaisSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      try {
        localStorage.setItem(STORAGE_KEYS.LOCAIS_URL, clean);
      } catch {}
      SHEET_URLS.PLANILHA_1_LOCAIS = clean;
      if (pushToServer) pushConfigToServer({ locaisUrl: clean });
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.LOCAIS_URL);
      } catch {}
      SHEET_URLS.PLANILHA_1_LOCAIS = '';
      if (pushToServer) pushConfigToServer({ locaisUrl: '' });
    }
  },

  getStoredLocais(): LocalVotacao[] {
    try {
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

  // --- Ocorrências ---
  getOcorrenciasSheetUrl(): string {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.OCORRENCIAS_URL);
      if (val && val.trim().startsWith('http') && !val.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
        SHEET_URLS.PLANILHA_2_OCORRENCIAS = val.trim();
        return val.trim();
      }
    } catch {}

    if (SHEET_URLS.PLANILHA_2_OCORRENCIAS && SHEET_URLS.PLANILHA_2_OCORRENCIAS.trim().startsWith('http') && !SHEET_URLS.PLANILHA_2_OCORRENCIAS.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
      return SHEET_URLS.PLANILHA_2_OCORRENCIAS.trim();
    }
    return DEFAULT_OCORRENCIAS_URL;
  },

  setOcorrenciasSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      try {
        localStorage.setItem(STORAGE_KEYS.OCORRENCIAS_URL, clean);
      } catch {}
      SHEET_URLS.PLANILHA_2_OCORRENCIAS = clean;
      if (pushToServer) pushConfigToServer({ ocorrenciasUrl: clean });
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.OCORRENCIAS_URL);
      } catch {}
      SHEET_URLS.PLANILHA_2_OCORRENCIAS = '';
      if (pushToServer) pushConfigToServer({ ocorrenciasUrl: '' });
    }
  },

  getStoredOcorrencias(): Ocorrencia[] {
    const is1oTurno = (o: any) => {
      const s = `${o?.carimbo || ''} ${o?.servicoDia || ''} ${o?.local || ''} ${o?.dinamica || ''}`.toLowerCase();
      return (
        (s.includes('03/10') || s.includes('03out') || s.includes('04/10') || s.includes('04out')) &&
        !(s.includes('24/10') || s.includes('25/10') || s.includes('24out') || s.includes('25out'))
      );
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OCORRENCIAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((o) => !is1oTurno(o));
          if (clean.length > 0) {
            return clean;
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao ler cache de ocorrencias:', e);
    }

    // Inicializa localmente com os dados oficiais do 2º Turno sem sobrescrever o servidor
    try {
      localStorage.setItem(STORAGE_KEYS.OCORRENCIAS, JSON.stringify(INITIAL_OCORRENCIAS));
    } catch {}
    return INITIAL_OCORRENCIAS;
  },

  saveOcorrencias(data: Ocorrencia[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.OCORRENCIAS, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar ocorrencias no localStorage:', e);
    }

    try {
      fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocorrencias: data }),
      }).catch(() => {});
    } catch {}
  },

  async fetchServerOcorrencias(): Promise<Ocorrencia[] | null> {
    try {
      const res = await fetch('/api/ocorrencias');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.ocorrencias) && json.ocorrencias.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.OCORRENCIAS, JSON.stringify(json.ocorrencias));
          } catch {}
          return json.ocorrencias;
        }
      }
    } catch {}
    return null;
  },

  // --- Faltas de Efetivo POE ---
  getFaltasSheetUrl(): string {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.FALTAS_URL);
      if (
        val &&
        val.trim().startsWith('http') &&
        !val.includes('613414577') &&
        !val.includes('789471674') &&
        !val.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')
      ) {
        SHEET_URLS.PLANILHA_3_FALTAS = val.trim();
        return val.trim();
      }
    } catch {}

    if (
      SHEET_URLS.PLANILHA_3_FALTAS &&
      SHEET_URLS.PLANILHA_3_FALTAS.trim().startsWith('http') &&
      !SHEET_URLS.PLANILHA_3_FALTAS.includes('613414577') &&
      !SHEET_URLS.PLANILHA_3_FALTAS.includes('789471674') &&
      !SHEET_URLS.PLANILHA_3_FALTAS.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')
    ) {
      return SHEET_URLS.PLANILHA_3_FALTAS.trim();
    }
    SHEET_URLS.PLANILHA_3_FALTAS = DEFAULT_FALTAS_URL;
    return DEFAULT_FALTAS_URL;
  },

  setFaltasSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      let clean = url.trim();
      if (clean.includes('789471674') || clean.includes('613414577') || clean.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')) {
        clean = DEFAULT_FALTAS_URL;
      }
      try {
        localStorage.setItem(STORAGE_KEYS.FALTAS_URL, clean);
      } catch {}
      SHEET_URLS.PLANILHA_3_FALTAS = clean;
      if (pushToServer) pushConfigToServer({ faltasUrl: clean });
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.FALTAS_URL);
      } catch {}
      SHEET_URLS.PLANILHA_3_FALTAS = '';
      if (pushToServer) pushConfigToServer({ faltasUrl: '' });
    }
  },

  getStoredFaltas(): FaltaEfetivo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FALTAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 65) {
          return parsed;
        }
        if (Array.isArray(parsed) && parsed.length > 65) {
          localStorage.removeItem(STORAGE_KEYS.FALTAS);
        }
      }
    } catch (e) {
      console.warn('Falha ao ler faltas do cache:', e);
    }
    const realFaltas = parseFaltasCsv(RAW_FALTAS_CSV);
    this.saveFaltas(realFaltas);
    return realFaltas;
  },

  saveFaltas(data: FaltaEfetivo[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.FALTAS, JSON.stringify(data));
      // Mantém verificação sincronizada caso não possua dados próprios
      const verif = localStorage.getItem(STORAGE_KEYS.VERIFICACAO);
      if (!verif || verif === '[]') {
        localStorage.setItem(STORAGE_KEYS.VERIFICACAO, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Erro ao salvar faltas no localStorage:', e);
    }

    try {
      fetch('/api/faltas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faltas: data }),
      }).catch(() => {});
    } catch {}
  },

  async fetchServerFaltas(): Promise<FaltaEfetivo[] | null> {
    try {
      const res = await fetch('/api/faltas');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.faltas) && json.faltas.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.FALTAS, JSON.stringify(json.faltas));
          } catch {}
          return json.faltas;
        }
      }
    } catch {}
    return null;
  },

  // --- Verificação de Faltas (Depuradas) ---
  getVerificacaoSheetUrl(): string {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.VERIFICACAO_URL);
      if (
        val &&
        val.trim().startsWith('http') &&
        !val.includes('613414577') &&
        !val.includes('789471674') &&
        !val.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')
      ) {
        SHEET_URLS.PLANILHA_4_VERIFICACAO = val.trim();
        return val.trim();
      }
    } catch {}

    if (
      SHEET_URLS.PLANILHA_4_VERIFICACAO &&
      SHEET_URLS.PLANILHA_4_VERIFICACAO.trim().startsWith('http') &&
      !SHEET_URLS.PLANILHA_4_VERIFICACAO.includes('613414577') &&
      !SHEET_URLS.PLANILHA_4_VERIFICACAO.includes('789471674') &&
      !SHEET_URLS.PLANILHA_4_VERIFICACAO.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')
    ) {
      return SHEET_URLS.PLANILHA_4_VERIFICACAO.trim();
    }
    SHEET_URLS.PLANILHA_4_VERIFICACAO = DEFAULT_VERIFICACAO_URL;
    return DEFAULT_VERIFICACAO_URL;
  },

  setVerificacaoSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      let clean = url.trim();
      if (clean.includes('789471674') || clean.includes('613414577') || clean.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')) {
        clean = DEFAULT_VERIFICACAO_URL;
      }
      try {
        localStorage.setItem(STORAGE_KEYS.VERIFICACAO_URL, clean);
      } catch {}
      SHEET_URLS.PLANILHA_4_VERIFICACAO = clean;
      if (pushToServer) pushConfigToServer({ verificacaoUrl: clean });
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.VERIFICACAO_URL);
      } catch {}
      SHEET_URLS.PLANILHA_4_VERIFICACAO = '';
      if (pushToServer) pushConfigToServer({ verificacaoUrl: '' });
    }
  },

  getStoredVerificacao(): FaltaEfetivo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.VERIFICACAO);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 65) {
          return parsed;
        }
        if (Array.isArray(parsed) && parsed.length > 65) {
          localStorage.removeItem(STORAGE_KEYS.VERIFICACAO);
        }
      }
    } catch (e) {
      console.warn('Falha ao ler dados depurados de verificação do cache:', e);
    }
    const realVerificadas = parseFaltasCsv(RAW_VERIFICACAO_CSV);
    this.saveVerificacao(realVerificadas);
    return realVerificadas;
  },

  saveVerificacao(data: FaltaEfetivo[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.VERIFICACAO, JSON.stringify(data));
      // Mantém faltas sincronizada caso não possua dados próprios
      const f = localStorage.getItem(STORAGE_KEYS.FALTAS);
      if (!f || f === '[]') {
        localStorage.setItem(STORAGE_KEYS.FALTAS, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Erro ao salvar verificacao no localStorage:', e);
    }

    try {
      fetch('/api/verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificacao: data }),
      }).catch(() => {});
    } catch {}
  },

  async fetchServerVerificacao(): Promise<FaltaEfetivo[] | null> {
    try {
      const res = await fetch('/api/verificacao');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.verificacao) && json.verificacao.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.VERIFICACAO, JSON.stringify(json.verificacao));
          } catch {}
          return json.verificacao;
        }
      }
    } catch {}
    return null;
  },

  // --- Controle de Acesso Remoto (Visitantes PM3) ---
  getControleSheetUrl(): string {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.CONTROLE_URL);
      if (val && val.trim().startsWith('http')) {
        SHEET_URLS.PLANILHA_5_CONTROLE = val.trim();
        return val.trim();
      }
    } catch {}

    if (SHEET_URLS.PLANILHA_5_CONTROLE && SHEET_URLS.PLANILHA_5_CONTROLE.trim().startsWith('http')) {
      return SHEET_URLS.PLANILHA_5_CONTROLE.trim();
    }
    return DEFAULT_CONTROLE_URL;
  },

  setControleSheetUrl(url: string, pushToServer = true) {
    if (url && url.trim().startsWith('http')) {
      const clean = url.trim();
      try {
        localStorage.setItem(STORAGE_KEYS.CONTROLE_URL, clean);
      } catch {}
      SHEET_URLS.PLANILHA_5_CONTROLE = clean;
      if (pushToServer) pushConfigToServer({ controleUrl: clean });
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.CONTROLE_URL);
      } catch {}
      SHEET_URLS.PLANILHA_5_CONTROLE = '';
      if (pushToServer) pushConfigToServer({ controleUrl: '' });
    }
  },

  getControleStatus(): 'LIBERADO' | 'BLOQUEADO' {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.CONTROLE_STATUS);
      if (val === 'BLOQUEADO') return 'BLOQUEADO';
    } catch {}
    return 'LIBERADO';
  },

  async setControleStatus(status: 'LIBERADO' | 'BLOQUEADO', pushToServer = true): Promise<boolean> {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTROLE_STATUS, status);
    } catch {}

    if (pushToServer) {
      try {
        await fetch('/api/controle-acesso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            controleUrl: this.getControleSheetUrl(),
          }),
        });
        return true;
      } catch (e) {
        console.warn('Erro ao atualizar controle de acesso no servidor:', e);
      }
    }
    return true;
  },

  async checkLiveControleStatus(customUrl?: string): Promise<{
    status: 'LIBERADO' | 'BLOQUEADO';
    source: string;
    rawText?: string;
  }> {
    const targetUrl = customUrl !== undefined ? customUrl.trim() : this.getControleSheetUrl();

    // 1. Se tiver URL da planilha Google, busca diretamente em tempo real
    if (targetUrl && targetUrl.startsWith('http')) {
      try {
        const text = await fetchGoogleSheetCsv(targetUrl);
        if (text && text.trim().length > 0) {
          const status = parseControleStatus(text);
          try {
            localStorage.setItem(STORAGE_KEYS.CONTROLE_STATUS, status);
          } catch {}
          return {
            status,
            source: 'planilha_google',
            rawText: text.slice(0, 150).trim(),
          };
        }
      } catch (err: any) {
        console.warn('Falha ao ler planilha remota de controle de acesso:', err);
      }
    }

    // 2. Consulta o backend do servidor (quando executando com servidor local)
    try {
      const res = await fetch('/api/controle-acesso');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'BLOQUEADO' || data.status === 'LIBERADO') {
          try {
            localStorage.setItem(STORAGE_KEYS.CONTROLE_STATUS, data.status);
          } catch {}
          if (data.controleUrl && !this.getControleSheetUrl()) {
            this.setControleSheetUrl(data.controleUrl, false);
          }
          return {
            status: data.status,
            source: 'servidor_central',
          };
        }
      }
    } catch (e) {}

    // 3. Fallback no valor salvo no navegador
    return {
      status: this.getControleStatus(),
      source: 'local_storage',
    };
  },

  // --- Limpeza Total de Caches Antigos & Reset para 2º Turno ---
  async clearAllCachesAndResetTo2Turno(): Promise<boolean> {
    try {
      // 1. Purga todas as chaves de localStorage
      OLD_KEYS_TO_PURGE.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(STORAGE_KEYS.OCORRENCIAS);
      localStorage.removeItem(STORAGE_KEYS.FALTAS);
      localStorage.removeItem(STORAGE_KEYS.VERIFICACAO);
      localStorage.removeItem(STORAGE_KEYS.OCORRENCIAS_URL);
      localStorage.removeItem(STORAGE_KEYS.FALTAS_URL);
      localStorage.removeItem(STORAGE_KEYS.VERIFICACAO_URL);

      SHEET_URLS.PLANILHA_2_OCORRENCIAS = DEFAULT_OCORRENCIAS_URL;
      SHEET_URLS.PLANILHA_3_FALTAS = DEFAULT_FALTAS_URL;
      SHEET_URLS.PLANILHA_4_VERIFICACAO = DEFAULT_VERIFICACAO_URL;

      // 2. Chama endpoint do servidor para limpar arquivos no disco
      await fetch('/api/clear-cache', { method: 'POST' }).catch(() => {});

      // 3. Salva novo estado inicial com os dados oficiais do 2º Turno
      this.saveOcorrencias(INITIAL_OCORRENCIAS);
      this.saveFaltas(INITIAL_FALTAS);
      this.saveVerificacao(INITIAL_FALTAS);

      return true;
    } catch (e) {
      console.error('Erro na limpeza de caches:', e);
      return false;
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
