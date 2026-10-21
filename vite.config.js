import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, 'data/db.json');

function getDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify({ leads: [], packages: null, extras: null }, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { leads: [], packages: null, extras: null };
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save db:', err);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function createApiMiddleware() {
  return async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();

    res.setHeader('Content-Type', 'application/json');

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // GET /api/leads
    if (req.method === 'GET' && pathname === '/api/leads') {
      const db = getDb();
      res.end(JSON.stringify(db.leads || []));
      return;
    }

    // POST /api/leads
    if (req.method === 'POST' && pathname === '/api/leads') {
      const body = await readBody(req);
      const db = getDb();
      db.leads = db.leads || [];
      const idx = db.leads.findIndex((l) => l.id === body.id);
      if (idx >= 0) {
        db.leads[idx] = { ...db.leads[idx], ...body, updatedAt: new Date().toISOString() };
      } else {
        db.leads.unshift({ ...body, createdAt: new Date().toISOString() });
      }
      saveDb(db);
      res.end(JSON.stringify({ ok: true, lead: body }));
      return;
    }

    // DELETE /api/leads/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/leads/')) {
      const id = pathname.replace('/api/leads/', '');
      const db = getDb();
      db.leads = (db.leads || []).filter((l) => l.id !== id);
      saveDb(db);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // PATCH /api/leads/:id
    if (req.method === 'PATCH' && pathname.startsWith('/api/leads/')) {
      const id = pathname.replace('/api/leads/', '');
      const body = await readBody(req);
      const db = getDb();
      db.leads = db.leads || [];
      const idx = db.leads.findIndex((l) => l.id === id);
      if (idx >= 0) {
        db.leads[idx] = { ...db.leads[idx], ...body, updatedAt: new Date().toISOString() };
        saveDb(db);
        res.end(JSON.stringify({ ok: true, lead: db.leads[idx] }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Lead not found' }));
      }
      return;
    }

    // GET /api/config
    if (req.method === 'GET' && pathname === '/api/config') {
      const db = getDb();
      res.end(JSON.stringify({ packages: db.packages, extras: db.extras }));
      return;
    }

    // POST /api/config
    if (req.method === 'POST' && pathname === '/api/config') {
      const body = await readBody(req);
      const db = getDb();
      if (body.packages !== undefined) db.packages = body.packages;
      if (body.extras !== undefined) db.extras = body.extras;
      saveDb(db);
      res.end(JSON.stringify({ ok: true, config: { packages: db.packages, extras: db.extras } }));
      return;
    }

    // POST /api/config/reset
    if (req.method === 'POST' && pathname === '/api/config/reset') {
      const db = getDb();
      db.packages = null;
      db.extras = null;
      saveDb(db);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}

function apiPlugin() {
  const handler = createApiMiddleware();
  return {
    name: 'api-server',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
