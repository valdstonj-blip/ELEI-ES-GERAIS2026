import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const CONFIG_FILE = path.resolve(__dirname, 'sheet-config.json');
const LOCAIS_DATA_FILE = path.resolve(__dirname, 'locais-data.json');
const OCORRENCIAS_DATA_FILE = path.resolve(__dirname, 'ocorrencias-data.json');
const FALTAS_DATA_FILE = path.resolve(__dirname, 'faltas-data.json');
const VERIFICACAO_DATA_FILE = path.resolve(__dirname, 'verificacao-data.json');

// Link fixo e oficial da Planilha de Faltas do 2º Turno (para todo o evento)
const OFFICIAL_FALTAS_URL =
  'https://docs.google.com/spreadsheets/d/1AyyegbNXdVKuo1zeuvh-MemyWfkaxUNuqxwbHtPX4p4/edit?gid=789471674#gid=789471674';

// Configuração Padrão do 2º Turno Oficial (24 e 25 de Outubro)
const DEFAULT_CONFIG = {
  locaisUrl: 'https://docs.google.com/spreadsheets/d/1j6fAH3lpWLf29B17vYmzz3O6DRtmsyCbA3eiFxCGjkw/edit?gid=580074849#gid=580074849',
  ocorrenciasUrl: 'https://docs.google.com/spreadsheets/d/1mjwbWLqU3rpnMtyHyKJzqj1u0cKrb3Hdx-Rx2BBNkGc/edit?gid=1689465461#gid=1689465461',
  faltasUrl: OFFICIAL_FALTAS_URL,
  verificacaoUrl: OFFICIAL_FALTAS_URL,
  updatedAt: new Date().toISOString(),
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.ocorrenciasUrl && parsed.ocorrenciasUrl.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
        parsed.ocorrenciasUrl = '';
      }
      if (parsed.faltasUrl && parsed.faltasUrl.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8')) {
        parsed.faltasUrl = OFFICIAL_FALTAS_URL;
      }
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        faltasUrl: parsed.faltasUrl || OFFICIAL_FALTAS_URL,
        verificacaoUrl: parsed.verificacaoUrl || OFFICIAL_FALTAS_URL,
      };
    }
  } catch (err) {
    console.error('Erro ao ler sheet-config.json:', err);
  }
  return DEFAULT_CONFIG;
}

function writeConfig(config: any) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Erro ao salvar sheet-config.json:', err);
    return false;
  }
}

function parseCsvRows(text: string): string[][] {
  const p: string[][] = [];
  let row: string[] = [];
  let col = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        col += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(col.trim());
      col = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(col.trim());
      col = '';
      if (row.some((cell) => cell.length > 0)) {
        p.push(row);
      }
      row = [];
    } else {
      col += c;
    }
  }
  if (col.length > 0 || row.length > 0) {
    row.push(col.trim());
    if (row.some((cell) => cell.length > 0)) {
      p.push(row);
    }
  }
  return p;
}

function normalizeCpaName(raw: string): string {
  if (!raw) return '1º CPA';
  const upper = raw.trim().toUpperCase();
  if (upper.includes('CPP')) return 'CPP';
  if (upper.includes('COE')) return 'COE';
  if (upper.includes('CPE')) return 'CPE';
  const match = upper.match(/([1-8])/);
  if (match) return `${match[1]}º CPA`;
  return raw.trim();
}

async function fetchLiveFaltasFromGoogle(targetUrl?: string): Promise<any[]> {
  const urlToUse = targetUrl || readConfig().faltasUrl || OFFICIAL_FALTAS_URL;
  if (!urlToUse || !urlToUse.includes('docs.google.com/spreadsheets/d/')) {
    return [];
  }
  const match = urlToUse.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return [];
  const sheetId = match[1];
  const gidMatch = urlToUse.match(/[?&#]gid=([0-9]+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;

  try {
    const resp = await fetch(exportUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) return [];
    const text = await resp.text();
    if (!text || text.length < 50 || text.includes('accounts.google.com')) return [];

    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];

    const parsed: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const carimbo = row[0] || '';
      const email = row[1] || '';
      const servicoDia = row[2] || '';
      const posto = row[3] || '';
      const rg = row[4] || '';
      const nomeGuerra = row[5] || '';
      const cpaRaw = row[6] || '';
      const opm = row[7] || '';
      const faltasPoe = row[8] || '';

      if (!nomeGuerra && !rg && !faltasPoe) continue;

      const cpa = normalizeCpaName(cpaRaw);
      parsed.push({
        id: `falta-resp-${i}`,
        carimbo,
        email,
        servicoDia,
        posto,
        rg,
        nomeGuerra,
        comandoIntermediario: cpa,
        opm,
        faltasPoe,
        dispensasPoe: 'sem alteração',
        data: '24/10/2026',
        turno: servicoDia,
        postoGrad: posto,
        opmOrigem: `${cpa} / ${opm}`,
        uopDestino: opm,
        localVotacao: 'POE - Escala Operacional',
        motivo: faltasPoe,
        substituto: 'sem alteração',
        status: 'REGISTRADO',
        cpa,
        tipoRegistro: 'FALTA',
        informante: `${posto} ${nomeGuerra} (RG: ${rg})`.trim(),
      });
    }

    if (parsed.length > 0) {
      fs.writeFileSync(FALTAS_DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      fs.writeFileSync(VERIFICACAO_DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      console.log(`[EMG-PM/3] Sincronização direta com Google Sheets concluída com sucesso: ${parsed.length} envios salvos.`);
      return parsed;
    }
  } catch (err) {
    console.warn('[EMG-PM/3] Aviso ao sincronizar Google Sheets remotamente:', err);
  }
  return [];
}

// 1. Configuração ativa de planilhas (Links do Sistema)
app.get('/api/sheet-config', (_req, res) => {
  const cfg = readConfig();
  res.json(cfg);
});

app.post('/api/sheet-config', (req, res) => {
  const current = readConfig();
  const { locaisUrl, ocorrenciasUrl, faltasUrl, verificacaoUrl } = req.body || {};

  const updated = {
    ...current,
    locaisUrl: typeof locaisUrl === 'string' ? locaisUrl.trim() : current.locaisUrl,
    ocorrenciasUrl: typeof ocorrenciasUrl === 'string' ? ocorrenciasUrl.trim() : current.ocorrenciasUrl,
    faltasUrl: typeof faltasUrl === 'string' ? faltasUrl.trim() : current.faltasUrl,
    verificacaoUrl: typeof verificacaoUrl === 'string' ? verificacaoUrl.trim() : current.verificacaoUrl,
    updatedAt: new Date().toISOString(),
  };

  const ok = writeConfig(updated);
  if (ok) {
    console.log('[EMG-PM/3] Links de planilhas atualizados e fixados no servidor:', updated);
    res.json({ success: true, config: updated });
  } else {
    res.status(500).json({ success: false, message: 'Falha ao salvar configuração no servidor.' });
  }
});

// 2. Persistência de Locais de Votação
app.get('/api/locais', (_req, res) => {
  try {
    if (fs.existsSync(LOCAIS_DATA_FILE)) {
      const raw = fs.readFileSync(LOCAIS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, locais: parsed });
      }
    }
  } catch (err) {
    console.error('Erro ao ler locais-data.json:', err);
  }
  res.json({ success: false, locais: [] });
});

app.post('/api/locais', (req, res) => {
  try {
    const { locais } = req.body || {};
    if (Array.isArray(locais) && locais.length > 0) {
      fs.writeFileSync(LOCAIS_DATA_FILE, JSON.stringify(locais), 'utf-8');
      console.log(`[EMG-PM/3] ${locais.length} locais salvos com persistência no servidor.`);
      return res.json({ success: true, count: locais.length });
    }
    res.status(400).json({ success: false, message: 'Dados de locais inválidos.' });
  } catch (err: any) {
    console.error('Erro ao gravar locais-data.json:', err);
    res.status(500).json({ success: false, message: err?.message });
  }
});

// 3. Persistência de Ocorrências (2º Turno Oficial)
app.get('/api/ocorrencias', (_req, res) => {
  try {
    if (fs.existsSync(OCORRENCIAS_DATA_FILE)) {
      const raw = fs.readFileSync(OCORRENCIAS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filtra para garantir que não haja sobras antigas do 1º turno
        const clean = parsed.filter((o: any) => {
          const s = `${o?.carimbo || ''} ${o?.servicoDia || ''} ${o?.dinamica || ''}`.toLowerCase();
          return !(
            (s.includes('03/10') || s.includes('03out') || s.includes('04/10') || s.includes('04out')) &&
            !(s.includes('24/10') || s.includes('25/10') || s.includes('24out') || s.includes('25out'))
          );
        });
        return res.json({ success: true, count: clean.length, ocorrencias: clean });
      }
    }
  } catch (err) {
    console.error('Erro ao ler ocorrencias-data.json:', err);
  }
  res.json({ success: false, ocorrencias: [] });
});

app.post('/api/ocorrencias', (req, res) => {
  try {
    const { ocorrencias } = req.body || {};
    if (Array.isArray(ocorrencias)) {
      fs.writeFileSync(OCORRENCIAS_DATA_FILE, JSON.stringify(ocorrencias, null, 2), 'utf-8');
      console.log(`[EMG-PM/3] ${ocorrencias.length} ocorrência(s) persistida(s) no servidor.`);
      return res.json({ success: true, count: ocorrencias.length });
    }
    res.status(400).json({ success: false, message: 'Formato de ocorrências inválido.' });
  } catch (err: any) {
    console.error('Erro ao gravar ocorrencias-data.json:', err);
    res.status(500).json({ success: false, message: err?.message });
  }
});

// 4. Persistência de Faltas no POE (2º Turno Oficial)
app.get('/api/faltas', async (req, res) => {
  const forceSync = req.query.sync === 'true' || !fs.existsSync(FALTAS_DATA_FILE);
  if (forceSync) {
    await fetchLiveFaltasFromGoogle();
  }

  try {
    if (fs.existsSync(FALTAS_DATA_FILE)) {
      const raw = fs.readFileSync(FALTAS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, faltas: parsed });
      }
    }
    // Fallback: se faltas-data estiver vazio, usa verificacao-data
    if (fs.existsSync(VERIFICACAO_DATA_FILE)) {
      const raw = fs.readFileSync(VERIFICACAO_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, faltas: parsed });
      }
    }
  } catch (err) {
    console.error('Erro ao ler faltas-data.json:', err);
  }

  // Segunda tentativa buscando ao vivo
  const live = await fetchLiveFaltasFromGoogle();
  if (live.length > 0) {
    return res.json({ success: true, count: live.length, faltas: live });
  }

  res.json({ success: false, faltas: [] });
});

app.post('/api/sync-faltas', async (req, res) => {
  const targetUrl = req.body?.url;
  const live = await fetchLiveFaltasFromGoogle(targetUrl);
  res.json({ success: true, count: live.length, faltas: live });
});

app.post('/api/faltas', (req, res) => {
  try {
    const { faltas } = req.body || {};
    if (Array.isArray(faltas)) {
      fs.writeFileSync(FALTAS_DATA_FILE, JSON.stringify(faltas, null, 2), 'utf-8');
      // Sincroniza também a base de verificação para manter ambas consistentes
      fs.writeFileSync(VERIFICACAO_DATA_FILE, JSON.stringify(faltas, null, 2), 'utf-8');
      console.log(`[EMG-PM/3] ${faltas.length} falta(s) persistida(s) no servidor.`);
      return res.json({ success: true, count: faltas.length });
    }
    res.status(400).json({ success: false, message: 'Formato de faltas inválido.' });
  } catch (err: any) {
    console.error('Erro ao gravar faltas-data.json:', err);
    res.status(500).json({ success: false, message: err?.message });
  }
});

// 5. Persistência de Verificação de Faltas
app.get('/api/verificacao', async (req, res) => {
  const forceSync = req.query.sync === 'true' || !fs.existsSync(VERIFICACAO_DATA_FILE);
  if (forceSync) {
    await fetchLiveFaltasFromGoogle();
  }

  try {
    if (fs.existsSync(VERIFICACAO_DATA_FILE)) {
      const raw = fs.readFileSync(VERIFICACAO_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, verificacao: parsed });
      }
    }
    // Fallback: se verificacao estiver vazio, usa faltas-data
    if (fs.existsSync(FALTAS_DATA_FILE)) {
      const raw = fs.readFileSync(FALTAS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, verificacao: parsed });
      }
    }
  } catch (err) {
    console.error('Erro ao ler verificacao-data.json:', err);
  }

  const live = await fetchLiveFaltasFromGoogle();
  if (live.length > 0) {
    return res.json({ success: true, count: live.length, verificacao: live });
  }

  res.json({ success: false, verificacao: [] });
});

app.post('/api/verificacao', (req, res) => {
  try {
    const { verificacao } = req.body || {};
    if (Array.isArray(verificacao)) {
      fs.writeFileSync(VERIFICACAO_DATA_FILE, JSON.stringify(verificacao, null, 2), 'utf-8');
      // Sincroniza também faltas para manter ambas consistentes
      fs.writeFileSync(FALTAS_DATA_FILE, JSON.stringify(verificacao, null, 2), 'utf-8');
      console.log(`[EMG-PM/3] ${verificacao.length} registro(s) de verificação persistido(s) no servidor.`);
      return res.json({ success: true, count: verificacao.length });
    }
    res.status(400).json({ success: false, message: 'Formato de verificação inválido.' });
  } catch (err: any) {
    console.error('Erro ao gravar verificacao-data.json:', err);
    res.status(500).json({ success: false, message: err?.message });
  }
});

// 6. Endpoint de Limpeza Total de Caches Antigos (Reset 2º Turno Oficial)
app.post('/api/clear-cache', (_req, res) => {
  try {
    // Remove arquivos de dados antigos do 1º turno
    if (fs.existsSync(OCORRENCIAS_DATA_FILE)) fs.unlinkSync(OCORRENCIAS_DATA_FILE);
    if (fs.existsSync(FALTAS_DATA_FILE)) fs.unlinkSync(FALTAS_DATA_FILE);
    if (fs.existsSync(VERIFICACAO_DATA_FILE)) fs.unlinkSync(VERIFICACAO_DATA_FILE);

    // Limpa links antigos do 1º turno na configuração
    const cfg = readConfig();
    const cleanCfg = {
      ...cfg,
      ocorrenciasUrl: '',
      faltasUrl: '',
      verificacaoUrl: '',
      updatedAt: new Date().toISOString(),
    };
    writeConfig(cleanCfg);

    console.log('[EMG-PM/3] Caches antigos do 1º turno purgados do servidor com sucesso.');
    res.json({
      success: true,
      message: 'Caches purgados do servidor com sucesso. Pronto para inserção das novas planilhas do 2º Turno!',
      config: cleanCfg,
    });
  } catch (err: any) {
    console.error('Erro ao limpar cache:', err);
    res.status(500).json({ success: false, message: err?.message });
  }
});

// Proxy para evitar problemas de CORS no celular/redes móveis
app.get('/api/proxy-sheet', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('URL inválida');
  }
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const text = await resp.text();
    const lower = text.toLowerCase();
    if (
      lower.includes('accounts.google.com') ||
      lower.includes('servicelogin') ||
      lower.includes('google doc error') ||
      lower.includes('fazer login')
    ) {
      return res.status(403).send('GOOGLE_SHEETS_RESTRICTED');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err: any) {
    res.status(502).send(err?.message || 'Falha ao buscar planilha remota');
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`EMG-PM/3 Server rodando na porta ${PORT}`);
    // Sincroniza imediatamente com a planilha oficial do 2º Turno no boot
    fetchLiveFaltasFromGoogle().catch((err) => {
      console.warn('Boot sync warning:', err);
    });
  });

  server.on('error', (err: any) => {
    console.error('EMG-PM/3 Server error:', err);
  });
}

startServer();
