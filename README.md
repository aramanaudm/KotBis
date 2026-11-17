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

- **Node.js 22** or newer, and npm
- **PostgreSQL 16** (or compatible) with **PostGIS 3.4**
- A PostgreSQL user that can create a database and enable extensions

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

More detail is in [`database/README.md`](database/README.md).

## 2. Backend API

```bash
cd backend
npm ci
```

Copy the environment template and fill in credentials:

```bash
cp .env.example .env
```

The server reads **`DATABASE_URL`** (not the `DB_*` keys in the example). Add a line like:

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/kotbis
```

Start in development (reloads on file changes):

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

Production-style run:

```bash
npm run build
npm start
```

## 3. Frontend (Ionic / Angular)

Open a second terminal:

```bash
cd frontend
npm ci
npm start
```

The app is served at [http://localhost:4200](http://localhost:4200). Default route is **Favoris**; the map is under `/home`, account under `/mon-espace`.

Useful scripts:

| Command | What it does |
|---|---|
| `npm start` | Dev server (`ng serve`) |
| `npm run build` | Production build into `www/` |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright e2e (expects the app on port 4200) |
| `npm run lint` | ESLint + Prettier check |

To run the built web app on a device later, Capacitor is already configured (`frontend/capacitor.config.ts`). That is optional for local web development.

## Typical local setup

1. Create the database and insert roles.
2. Start the API: `cd backend && npm run dev`.
3. Start the UI: `cd frontend && npm start`.
4. Open [http://localhost:4200](http://localhost:4200).

You can use the frontend without the API today. Registration against PostgreSQL is `POST /api/inscription` on the backend (`pseudo`, `email`, `motDePasse` of at least 8 characters).

## Docs

- [`docs/`](docs/) — specs (MCD, MPD, data dictionary, back-office / database)
- [`backend/documentation/`](backend/documentation/) — backend notes
- [`database/README.md`](database/README.md) — schema install
