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

// Configuração Padrão do 2º Turno Oficial (24 e 25 de Outubro)
// Não pré-carrega URLs do 1º Turno (evita recuperar as 87 ocorrências antigas)
const DEFAULT_CONFIG = {
  locaisUrl: 'https://docs.google.com/spreadsheets/d/1j6fAH3lpWLf29B17vYmzz3O6DRtmsyCbA3eiFxCGjkw/edit',
  ocorrenciasUrl: '',
  faltasUrl: '',
  verificacaoUrl: '',
  updatedAt: new Date().toISOString(),
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Limpeza de segurança: se o arquivo no disco ainda tiver os links antigos do 1º turno com as 87 ocorrências, anula-os
      if (parsed.ocorrenciasUrl && parsed.ocorrenciasUrl.includes('1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE')) {
        parsed.ocorrenciasUrl = '';
      }
      if (parsed.faltasUrl && parsed.faltasUrl.includes('1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8') && parsed.faltasUrl.includes('613414577')) {
        parsed.faltasUrl = '';
      }
      return { ...DEFAULT_CONFIG, ...parsed };
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
app.get('/api/faltas', (_req, res) => {
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
  res.json({ success: false, faltas: [] });
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
app.get('/api/verificacao', (_req, res) => {
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
  });

  server.on('error', (err: any) => {
    console.error('EMG-PM/3 Server error:', err);
  });
}

startServer();
