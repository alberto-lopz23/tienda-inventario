import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { put } from '@vercel/blob';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import movementRoutes from './routes/movements.js';
import orderRoutes from './routes/orders.js';
import configRoutes from './routes/config.js';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes'), ok);
  }
});

app.post('/api/admin/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió una imagen' });
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const { url } = await put(`tienda/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype
      });
      return res.json({ url });
    }
    res.json({ url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', configRoutes);
app.use('/api/admin/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/movements', movementRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', orderRoutes);

app.get('/api/health', async (req, res) => {
  const info = {
    ok: false,
    has_url: !!process.env.DATABASE_URL,
    url_host: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : null,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    node: process.version
  };
  try {
    const r = await db.get('SELECT 1 AS ok');
    info.ok = r && r.ok === 1;
    info.tables = {};
    for (const table of ['products', 'movements', 'orders', 'config']) {
      const cols = await db.all(
        "SELECT column_name FROM information_schema.columns WHERE table_name = ? AND table_schema = 'public' ORDER BY ordinal_position",
        [table]
      );
      info.tables[table] = cols.map((c) => c.column_name);
    }
    const probe = await db.get('SELECT id FROM products ORDER BY id LIMIT 1');
    info.id_probe = probe ? `ok (primera fila id=${probe.id})` : 'ok (tabla vacía)';
    res.json(info);
  } catch (err) {
    info.error = err.message;
    res.status(500).json(info);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

// En un servidor persistente (Render/Railway/local) además servimos el frontend y las imágenes.
// En Vercel el frontend lo sirve Vercel y /api lo maneja la función serverless.
if (!process.env.VERCEL) {
  const UPLOAD_DIR = path.join(__dirname, 'uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR));

  const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Error de servidor' });
});

export default app;