# KotBis

KotBis is a Mauritius bus companion: travelers can browse the map, keep favorites, and manage an account; operators will later manage the network from a back office.

The repo is split into three parts:

| Folder | Role |
|---|---|
| `frontend/` | Ionic + Angular app (map, favorites, account, auth UI) |
| `backend/` | Express + TypeScript API |
| `database/` | PostgreSQL / PostGIS schema |

Frontend login and registration currently store accounts on the device. The API already exposes `/api/inscription`; the app is not wired to it yet.

## Prerequisites

- **Node.js 22** or newer, and npm (`node -v`, `npm -v`)
- **PostgreSQL 16+** with **PostGIS** (this machine was tested with PostgreSQL 18 under `C:\Program Files\PostgreSQL\18`)
- A PostgreSQL user that can create a database and enable extensions (usually `postgres`)

## Typical local setup

1. Create the database and insert roles.
2. Create `backend/.env` with a real `DATABASE_URL`.
3. Start the API: `cd backend` then `npm run dev`.
4. Start the UI: `cd frontend` then `npm start`.
5. Open [http://localhost:4200](http://localhost:4200).

You can use the frontend without the API today. Registration against PostgreSQL is `POST /api/inscription` (`pseudo`, `email`, `motDePasse` of at least 8 characters).

---

## 1. Database

From `database/`:

```bash
psql -U postgres -f kotbis_schema.sql
```

Then seed the roles (required for traveler registration):

```sql
\c kotbis

INSERT INTO roles (id, code, libelle) VALUES
  (1, 'voyageur',       'Voyageur'),
  (2, 'operateur',      'Opérateur'),
  (3, 'moderateur',     'Modérateur'),
  (4, 'administrateur', 'Administrateur')
ON CONFLICT (id) DO NOTHING;
```

### Windows: `psql` is not recognized

If PowerShell says `psql` is not recognized, PostgreSQL is installed but its `bin` folder is not on PATH. Use the full path (change `18` if your version folder is different):

```powershell
cd database
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f kotbis_schema.sql
```

For this terminal session only, you can also add `bin` to PATH:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql -U postgres -f kotbis_schema.sql
```

To make `psql` permanent: Windows Search → **Environment Variables** → **Path** → add `C:\Program Files\PostgreSQL\18\bin`.

Seed roles with the same executable:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d kotbis
```

Then paste the `INSERT INTO roles ...` block above.

If `CREATE EXTENSION postgis` fails, install the PostGIS bundle for your PostgreSQL version and rerun the schema.

More detail is in [`database/README.md`](database/README.md).

---

## 2. Backend API

```bash
cd backend
npm ci
```

If `npm ci` fails (no lockfile match, or a slow first install), use:

```bash
npm install
```

### Create `.env` and set `DATABASE_URL`

The server reads **`DATABASE_URL`**, not the `DB_*` keys in `.env.example`.

**macOS / Linux:**

```bash
cp .env.example .env
```

**Windows PowerShell:**

```powershell
cd backend
copy .env.example .env
notepad .env
```

Make the file look like this. Replace `YOUR_PASSWORD` with the password you use for `psql -U postgres`:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=kotbis
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/kotbis
```

The `DB_*` lines can stay; the current server code does not read them. `.env` is gitignored — do not commit it.

If the password contains `@`, `#`, `%`, or `/`, URL-encode it **inside `DATABASE_URL` only** (example: `@` → `%40`). Keep the raw password in `DB_PASSWORD` if you fill that field.

### Start the API

```bash
npm run dev
```

The API listens on [http://localhost:3000](http://localhost:3000). A GET on `/` should return:

```json
{
  "message": "Bienvenue sur l'API KotBis",
  "status": "OK"
}
```

If `npm run dev` fails, try:

```bash
npx tsx watch src/index.ts
```

Production-style run:

```bash
npm run build
npm start
```

If `npm start` fails after a successful build:

```bash
node dist/index.js
```

---

## 3. Frontend (Ionic / Angular)

Open a **second** terminal (keep the API running):

```bash
cd frontend
npm ci
npm start
```

The app is served at [http://localhost:4200](http://localhost:4200). Default route is **Favoris**; the map is under `/home`, account under `/mon-espace`.

### If the frontend does not start

Install without the lockfile check:

```bash
npm install
npm start
```

Call Angular directly:

```bash
npx ng serve
```

If port 4200 is already in use:

```bash
npx ng serve --port 4201
```

Then open [http://localhost:4201](http://localhost:4201).

Useful scripts:

| Command | What it does |
|---|---|
| `npm start` | Dev server (`ng serve`) |
| `npx ng serve` | Same server, bypasses the npm script |
| `npm run build` | Production build into `www/` |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright e2e (expects the app on port 4200) |
| `npm run lint` | ESLint + Prettier check |

To run the built web app on a device later, Capacitor is already configured (`frontend/capacitor.config.ts`). That is optional for local web development.

---

## Troubleshooting

| Problem | What to try |
|---|---|
| `psql` is not recognized | Use `& "C:\Program Files\PostgreSQL\18\bin\psql.exe"` or add that `bin` folder to PATH |
| `CREATE EXTENSION postgis` error | Install PostGIS for your PostgreSQL version, then rerun `kotbis_schema.sql` |
| API starts but DB calls fail | Check `DATABASE_URL` in `backend/.env` (user, password, database name `kotbis`) |
| Password with special characters | URL-encode the password in `DATABASE_URL` |
| `npm ci` fails | Use `npm install` in the same folder |
| Port 3000 in use | Set `PORT=3001` in `.env` and restart `npm run dev` |
| Port 4200 in use | `npx ng serve --port 4201` |
| Frontend works, API not needed | Expected for now — auth is stored on the device |

---

## Docs

- [`docs/`](docs/) — specs (MCD, MPD, data dictionary, back-office / database)
- [`backend/documentation/`](backend/documentation/) — backend notes
- [`database/README.md`](database/README.md) — schema install
