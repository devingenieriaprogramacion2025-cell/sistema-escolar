# Sistema Web de Gestion de Recursos y Operaciones Internas Escolares

Proyecto desacoplado en 3 capas:

- `frontend/` cliente HTML + CSS + JavaScript Vanilla
- `backend/` API REST Node.js + Express + JWT
- `database/` capa de diseno de datos SQL Server

## Arquitectura aplicada

### Frontend
- HTML5, CSS3, JS Vanilla
- `fetch` para consumo de API REST
- JWT almacenado en `localStorage`
- Guardas de autenticacion y autorizacion por rol
- Menu dinamico por permisos
- Vistas incluidas:
  - `login.html`
  - `dashboard.html`
  - `usuarios.html`
  - `inventario.html`
  - `prestamos.html`
  - `reservas.html`
  - `solicitudes.html`
  - `impresiones.html`
  - `reportes.html`

### Backend
- Node.js + Express
- Estructura modular por capas:
  - `models/`
  - `controllers/`
  - `routes/`
  - `middlewares/`
  - `services/`
  - `utils/`
- JWT auth y roles
- Validaciones de entrada
- Manejo de errores centralizado
- Auditoria de acciones

### Base de datos
- SQL Server
- Script de inicializacion: `database/sqlserver/init.sql`
- Esquema relacional con claves foraneas y restricciones
- Tablas fisicas con nombres en espanol (usuarios, recursos, prestamos, reservas, etc.)
- Datos iniciales de roles, admin y recursos demo

## Roles y permisos implementados

- `ADMIN`: acceso total, gestion usuarios, auditoria, reportes, todos los modulos.
- `DIRECTIVO`: dashboard, reportes, consulta inventario y prestamos.
- `INSPECTORIA`: gestion de inventario, prestamos, reservas, solicitudes e impresiones.
- `DOCENTE`: dashboard propio, solicitudes propias, reservas propias, impresiones propias, prestamos propios.
- `ENCARGADO`: gestion de recursos por area y consulta operativa de su area.

## Endpoints principales

Base URL: `http://localhost:3000/api`

- `POST /auth/login`
- `GET /auth/me`
- `GET|POST|PUT|PATCH /users`
- `GET|POST|PUT|DELETE /resources`
- `GET|POST|PUT /resources/categories`
- `GET|POST|PATCH /loans`
- `GET|POST|PATCH /reservations`
- `GET|POST|PATCH /requests`
- `GET|POST|PATCH /prints`
- `GET /dashboard`
- `GET /reports/summary`
- `GET /reports/export` (PDF)
- `GET /audit-logs`

## Instalacion y ejecucion en VS Code

### 1) Backend
```bash
cd backend
npm install
```

Crear archivo `.env` basado en `.env.example`:
```env
PORT=3000
DB_PROVIDER=sqlserver
SQLSERVER_SERVER=DESKTOP-U3N9KBF\SQLEXPRESS
SQLSERVER_DATABASE=sistema_escolar
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=change_this_password
SQLSERVER_ENCRYPT=true
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=8h
```

### 2) Inicializar base SQL Server
Ejecuta el script `database/sqlserver/init.sql` (por ejemplo desde SSMS).

Credenciales admin inicial:
- correo: `admin@admin.com`
- password: `123456`

### 3) Levantar API
```bash
cd backend
npm run dev
```

### 4) Frontend
Abrir archivos de `frontend/` con Live Server (o servidor estatico) y entrar por:
- `frontend/login.html`

## Arranque en un solo comando (Git Bash)

Desde la raiz del proyecto:

```bash
bash ./start-all.sh
```

El script:
- levanta backend (`node server.js`) en una ventana
- levanta frontend con `python -m http.server` si Python esta disponible
- abre automaticamente `login.html`

Para detener todo:

```bash
bash ./stop-all.sh
```

## Arranque alternativo (Windows PowerShell)

Desde la raiz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-all.ps1
```

## Estado actual

- Backend operativo sobre SQL Server (`mssql`).
- Inicializacion de base y datos demo en `database/sqlserver/init.sql`.
- Login, autorizacion por roles, modulos CRUD, reportes y auditoria funcionando con SQL Server.
