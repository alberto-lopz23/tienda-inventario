# Tienda con inventario, pedidos y WhatsApp

Sistema web para tu tienda: catálogo público con stock en vivo, carrito de compras y envío de pedidos por WhatsApp, más un panel de administración con control de inventario.

## Características

- **Catálogo público**: productos con imagen, precio, categorías y buscador.
- **Stock en tiempo real**: los productos agotados se muestran como "Agotado" y no se pueden comprar.
- **Pedidos por WhatsApp**: el cliente arma su carrito, lo confirma y el pedido se envía por WhatsApp con los detalles y total.
- **Panel admin**: resumen (ventas, stock bajo), productos (crear/editar/eliminar + subir fotos), control de stock con historial de movimientos, pedidos (confirmar/entregar/cancelar) y configuración.
- **Sincronización automática**: al confirmarse un pedido se descuenta el stock; al cancelarse se devuelve.

## Requisitos

- Node.js 18 o superior

## Instalación

```bash
npm install
npm run install-all
```

## Desarrollo

```bash
npm run dev
```

- Tienda: http://localhost:5173
- API: http://localhost:4000

## Producción (servir todo desde un solo puerto)

Para un servidor tradicional (VPS, Render, Railway) con Postgres:

```bash
npm run build
npm start
```

Abre **http://localhost:4000**

## Desplegar en Vercel

Vercel es serverless, así que este proyecto usa una **base de datos externa (Postgres)** y sube las imágenes a **Vercel Blob**.

1. **Base de datos**: crea una base Postgres gratis en [Neon](https://neon.tech) (o usa la integración de Vercel Postgres en tu proyecto). Copia la cadena de conexión.
2. **Vercel Blob (imágenes)**: en tu proyecto de Vercel ve a **Storage → Blob → Create store** y copia el token de lectura/escritura.
3. En Vercel, agrega las variables de entorno del proyecto:
   - `DATABASE_URL` → la cadena de conexión de Postgres (obligatoria).
   - `BLOB_READ_WRITE_TOKEN` → token de Vercel Blob (opcional, pero sin él las imágenes se guardan como data URL en la BD).
4. Importa el repositorio en Vercel (framework: Other). `vercel.json` ya configura build, instalación y rewrites.
5. Despliega. El catálogo, el admin y la API quedan en el mismo dominio.

> ⚠️ En producción cambia la contraseña por defecto `admin123` en **Configuración**.

### Corre local con Postgres

Ahora la app necesita una base Postgres en vez de SQLite. Crea el archivo `server/.env`:

```
DATABASE_URL=postgres://...
BLOB_READ_WRITE_TOKEN=...
```

Luego `npm run dev`. La BD se crea y llena sola la primera vez.

## Primer uso

1. Entra a **Admin** (arriba a la derecha).
2. Inicia sesión con la contraseña por defecto: `admin123`.
3. Ve a **Configuración**:
   - Pon el **nombre de tu tienda**.
   - Pon tu **número de WhatsApp** con código de país (ej: `5215512345678`) para recibir los pedidos.
   - Cambia la contraseña de administrador.
4. Crea tus productos en la pestaña **Productos**.

## Estructura

```
tienda-inventario/
├── api/              # Función serverless de Vercel (handler de Express)
├── server/           # API (Express + Postgres)
│   ├── app.js        # Aplicación Express (rutas, uploads)
│   ├── index.js      # Punto de entrada local (app.listen)
│   ├── db.js         # Conexión a Postgres, esquema y datos iniciales
│   └── routes/       # Endpoints
└── client/           # Frontend (React + Vite)
    └── src/
        ├── pages/    # Catálogo, checkout y panel admin
        ├── components/
        └── context/  # Carrito de compras
```

## Notas

- La base de datos es **Postgres** (definida por `DATABASE_URL`). El esquema y los productos de ejemplo se crean automáticamente la primera vez.
- Las imágenes subidas se guardan en **Vercel Blob** (o como data URL si no configuras el token).