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

const DEFAULT_CONFIG = {
  locaisUrl:
    'https://docs.google.com/spreadsheets/d/1j6fAH3lpWLf29B17vYmzz3O6DRtmsyCbA3eiFxCGjkw/edit?gid=907029771#gid=907029771',
  ocorrenciasUrl:
    'https://docs.google.com/spreadsheets/d/1RZVL9kIIZET3JDl1pg01V-dFy-WUGZkaiNdMr30uOwE/edit?gid=2054351637#gid=2054351637',
  faltasUrl:
    'https://docs.google.com/spreadsheets/d/1RySRUm3i_GZPsXzAc5y9oa0onfeH1dFYhJMUnKZPSN8/edit?gid=613414577#gid=613414577',
  updatedAt: new Date().toISOString(),
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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

// Endpoint para ler configuração ativa de planilhas
app.get('/api/sheet-config', (_req, res) => {
  const cfg = readConfig();
  res.json(cfg);
});

// Endpoint para gravar e sincronizar links de planilhas entre todos os dispositivos
app.post('/api/sheet-config', (req, res) => {
  const current = readConfig();
  const { locaisUrl, ocorrenciasUrl, faltasUrl } = req.body || {};

  const updated = {
    ...current,
    locaisUrl:
      typeof locaisUrl === 'string'
        ? (locaisUrl.trim().startsWith('http') ? locaisUrl.trim() : (locaisUrl.trim() === '' ? '' : current.locaisUrl))
        : current.locaisUrl,
    ocorrenciasUrl:
      typeof ocorrenciasUrl === 'string'
        ? (ocorrenciasUrl.trim().startsWith('http') ? ocorrenciasUrl.trim() : '')
        : current.ocorrenciasUrl,
    faltasUrl:
      typeof faltasUrl === 'string'
        ? (faltasUrl.trim().startsWith('http') ? faltasUrl.trim() : '')
        : current.faltasUrl,
    updatedAt: new Date().toISOString(),
  };

  const ok = writeConfig(updated);
  if (ok) {
    console.log('[EMG-PM/3] Links de planilhas atualizados no servidor:', updated);
    res.json({ success: true, config: updated });
  } else {
    res.status(500).json({ success: false, message: 'Falha ao salvar configuração no servidor.' });
  }
});

// Endpoint para persistência permanente de locais de votação
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
    res.status(400).json({ success: false, message: 'Dados inválidos ou vazios.' });
  } catch (err: any) {
    console.error('Erro ao gravar locais-data.json:', err);
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
