import 'dotenv/config';
import pg from 'pg';
import { scryptSync, randomBytes, randomUUID } from 'crypto';

const { Pool } = pg;

let rawUrl = (process.env.DATABASE_URL || '').trim();
rawUrl = rawUrl.replace(/(&|\?)channel_binding=[^&\s]+/g, (m, p1) => (p1 === '?' ? '' : '&'));

const pool = new Pool({
  connectionString: rawUrl || undefined,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

function convertPlaceholders(text) {
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
}

const MISSING_URL_MSG =
  'Falta DATABASE_URL. Configúrala en Vercel (Settings → Environment Variables) o crea server/.env para correr local.';

function makeQuerier(query) {
  return {
    async all(text, params = []) {
      const res = await query(convertPlaceholders(text), params);
      return res.rows;
    },
    async get(text, params = []) {
      const res = await query(convertPlaceholders(text), params);
      return res.rows[0];
    },
    async run(text, params = []) {
      const res = await query(convertPlaceholders(text), params);
      return { lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : undefined };
    }
  };
}

async function rawRun(text, params = []) {
  const res = await pool.query(convertPlaceholders(text), params);
  return { lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : undefined };
}

async function rawGet(text, params = []) {
  const res = await pool.query(convertPlaceholders(text), params);
  return res.rows[0];
}

async function setConfig(key, value) {
  await rawRun('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
    key,
    String(value)
  ]);
}

export async function getConfig(key) {
  const row = await rawGet('SELECT value FROM config WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function createAdminToken() {
  const token = randomUUID();
  await setConfig('admin_token', token);
  return token;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt.toString('hex')}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes('$')) return false;
  const [salt, hash] = String(stored).split('$');
  const test = scryptSync(String(password), Buffer.from(salt, 'hex'), 64);
  return test.toString('hex') === hash;
}

async function seed() {
  if (!(await getConfig('shop_name'))) await setConfig('shop_name', 'Evolution Garage');
  if (!(await getConfig('admin_password_hash'))) await setConfig('admin_password_hash', hashPassword('admin123'));
  if (!(await getConfig('whatsapp_number'))) await setConfig('whatsapp_number', '');

  const countRow = await rawGet('SELECT COUNT(*)::int AS c FROM products');
  if (countRow.c === 0) {
    const demo = [
      ['Cera de carnaúba premium', 'Brillo profundo y protección de 3 meses. Fácil de aplicar a mano.', 14900, 'Ceras y abrillantadores', '', 15, 5],
      ['Shampoo automotriz espuma', 'Fórmula pH neutro, genera espuma abundante sin dañar la cera.', 12500, 'Lavado', '', 20, 5],
      ['Paños de microfibra (pack x3)', 'Suaves y sin pelusa, ideales para secado y pulido.', 9900, 'Lavado', '', 30, 5],
      ['Sellador cerámico 9H', 'Protección cerámica de hasta 12 meses, efecto hidrofóbico.', 18900, 'Selladores', '', 8, 5],
      ['Pulidora orbital', 'Pulidora de doble acción 12V con kit de pads incluidos.', 25900, 'Equipo', '', 4, 3],
      ['Kit de detallado completo', 'Todo en uno: shampoo, cera, microfibra, cepillos y desengrasante.', 34900, 'Kits', '', 6, 3],
      ['Cepillos para rines', 'Set de 5 cepillos para limpieza profunda de rines y llantas.', 6500, 'Lavado', '', 12, 5],
      ['Desengrasante profundo', 'Elimina grasa y suciedad pesada de motor y rines.', 8900, 'Productos químicos', '', 10, 5],
      ['Protector de llantas', 'Acabado satinado que revive el plástico de las llantas.', 7000, 'Detallado', '', 18, 5],
      ['Cobertor de auto pulido', 'Microfibra premium de 600 gsm para pulido sin rayones.', 11500, 'Accesorios', '', 7, 3],
      ['Aspiradora de taller húmedo/seco 20L', 'Potencia 1600W, ideal para interiores, asientos y baúles.', 21900, 'Equipo', '', 5, 3],
      ['Lavadora a presión eléctrica 1600W', 'Alta presión para lavados profesionales en casa.', 32900, 'Equipo', '', 6, 2],
      ['Compresor de aire portátil', 'Infla llantas, limpia rincones difíciles y seca detalles.', 12500, 'Equipo', '', 8, 3],
      ['Pads de pulido (pack x6)', 'Set de pads (naranja, azul y negro) para corregir y rematar.', 13500, 'Accesorios', '', 9, 4],
      ['Shampoo sin enjuague', 'Lava y abrillanta sin agua, perfecto para uso rápido.', 13500, 'Lavado', '', 14, 5],
      ['Toalla de secado gigante', 'Super microfibra 400 gsm de 75x95 cm, absorción extrema.', 15000, 'Accesorios', '', 10, 4],
      ['Rapid detailer con cera', 'Brillo instantáneo con cera para entre lavados.', 9200, 'Detallado', '', 16, 5],
      ['Limpiador de vidrios automotriz', 'Elimina grasa y manchas sin dejar residuos ni rayas.', 6500, 'Productos químicos', '', 20, 5],
      ['Kit de barro descontaminante', 'Kit clay bar + lubricante para una pintura lisa al tacto.', 16800, 'Kits', '', 7, 3],
      ['Cera spray de secado rápido', 'Protege y abrillanta en minutos al secar, uso fácil.', 11000, 'Ceras y abrillantadores', '', 18, 5],
      ['Revividor de plásticos interior', 'Acabado mate que regenera tableros y molduras.', 7800, 'Interior', '', 12, 5],
      ['Sellador de rines metalizados', 'Evita freno en polvo y facilita la limpieza de rines.', 14500, 'Selladores', '', 8, 4],
      ['Alcohol isopropílico 99% 1L', 'Perfecto para remover cera y residuos antes de sellar.', 5500, 'Productos químicos', '', 24, 5],
      ['Guantes de lavado microfibra', 'Par de guantes peludos para lavado sin rayones.', 9500, 'Lavado', '', 15, 5],
      ['Aplicador de cera y sellador', 'Esponja de precisión para una aplicación uniforme.', 5000, 'Accesorios', '', 30, 5],
      ['Protector UV plásticos exterior', 'Sella y protege molduras negras del sol.', 8500, 'Detallado', '', 11, 4],
      ['Desodorante automotriz premium', 'Aroma duradero que impregna toda la cabina.', 7000, 'Interior', '', 22, 5]
    ];
    for (const p of demo) {
      await rawRun(
        `INSERT INTO products (name, description, price_cents, category, image, stock, low_stock_threshold, requires_installation, installation_price_cents, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [...p, 0, 0]
      );
    }
  }

  const setInstall = (cost, name) =>
    rawRun('UPDATE products SET requires_installation = 1, installation_price_cents = ? WHERE name = ?', [cost, name]);
  await setInstall(45000, 'Lavadora a presión eléctrica 1600W');
  await setInstall(120000, 'Sellador cerámico 9H');
  await setInstall(25000, 'Compresor de aire portátil');
}

async function init() {
  if (!rawUrl) throw new Error(MISSING_URL_MSG);

  const statements = [
    `CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      category TEXT DEFAULT '',
      image TEXT DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      requires_installation INTEGER NOT NULL DEFAULT 0,
      installation_price_cents INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      items TEXT NOT NULL,
      total_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente',
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ];

  for (const st of statements) {
    await pool.query(st);
  }

  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_installation INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_price_cents INTEGER NOT NULL DEFAULT 0');

  await seed();
}

let initPromise = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export const db = makeQuerier(async (text, params) => {
  await ensureInit();
  return pool.query(text, params);
});

export async function transaction(fn) {
  await ensureInit();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = makeQuerier((text, params) => client.query(text, params));
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}
db.transaction = transaction;