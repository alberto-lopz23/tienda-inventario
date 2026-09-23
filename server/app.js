import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { requireAdmin } from './middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', true);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  })
);

const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    }
  })
);
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimetype);
    if (!ok) {
      const err = new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP, AVIF)');
      err.status = 400;
      return cb(err, false);
    }
    cb(null, true);
  }
});

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif'
};

app.post('/api/admin/upload', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió una imagen' });
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const ext = EXT_BY_MIME[req.file.mimetype] || '.jpg';
      const { url } = await put(`tienda/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype
      });
      return res.json({ url });
    }
    res.json({ url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` });
  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ error: `Error al subir la imagen: ${err.message}` });
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
    blob: !!process.env.BLOB_READ_WRITE_TOKEN
  };
  try {
    const r = await db.get('SELECT 1 AS ok');
    info.ok = r && r.ok === 1;
    res.json(info);
  } catch (err) {
    info.error = 'no_db';
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
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'La imagen es demasiado grande (máximo 8 MB)' });
  }
  const status = err.status || 500;
  res.status(status).json({ error: status >= 500 ? 'Error de servidor' : err.message });
});

export default app;