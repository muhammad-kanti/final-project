# NSUK Campus Emergency Response System

A real-time campus emergency response system for **Nasarawa State University, Keffi (NSUK)**. Students and staff can raise an emergency alert in one tap — with GPS, a searched place, or a written location — even while offline. Reporters can track and withdraw their own reports, while campus security responders triage every report from a live admin dashboard.

> **Status:** demo / course project. Persistence is a file-backed JSON store intended for local and single-instance use. See [Production considerations](#production-considerations) before deploying.

---

## Table of contents
- [Features](#features)
- [Tech stack & services](#tech-stack--services)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Authentication & authorization](#authentication--authorization)
- [Offline-first design](#offline-first-design)
- [Maps & geocoding](#maps--geocoding)
- [Installation](#installation)
- [First-time setup & accounts](#first-time-setup--accounts)
- [Available scripts](#available-scripts)
- [Data storage & resetting](#data-storage--resetting)
- [Security notes](#security-notes)
- [Production considerations](#production-considerations)

---

## Features

**Reporter (public / signed-in)**
- One-tap **SOS** alert with an emergency type (medical, fire, accident, theft, assault, other).
- Location capture three ways: **device GPS**, **place search** (Esri geocoder), or a **written description** for poor-GPS/indoor cases.
- Optional free-text details for responders.
- Works **offline**: alerts are queued in the browser (IndexedDB) and auto-sync when the connection returns.
- Sign in to **track**, **view responder updates**, and **delete/withdraw** your own reports.
- Alerts can be sent **without an account**; signing in just adds tracking.

**Responder / Admin**
- Live dashboard with **SSE** feed (refreshes every 2s).
- Stat cards: pending, active, resolved, critical, total.
- Triage actions: **Acknowledge**, **In Progress**, **Resolve**, **False Alarm**.
- Add **notes** (shown to the reporter), edit report details/location, and delete any report.
- Priority badges and status colour coding.

---

## Tech stack & services

### Runtime & framework
| Tool | Version | Role |
| --- | --- | --- |
| [Next.js](https://nextjs.org) | 16.3.8 | App Router, server components, route handlers, `proxy` (middleware) |
| [React](https://react.dev) | 19.2.8 | UI (client + server components) |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety across the app |
| [Node.js](https://nodejs.org) | 18+ (developed on 24) | Server runtime for route handlers |
| [`server-only`](https://www.npmjs.com/package/server-only) | ^0.0.1 | Build-time guard so server modules can't be imported client-side |

### Styling & tooling
| Tool | Version | Role |
| --- | --- | --- |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Utility-first styling (`@tailwindcss/postcss`) |
| [ESLint](https://eslint.org) | 9 | Linting via `eslint-config-next` (core-web-vitals + TS) |
| [PostCSS](https://postcss.org) | via `@tailwindcss/postcss` | CSS pipeline |

### External services (all keyless, no API keys required)
| Service | Endpoint | Role |
| --- | --- | --- |
| **Esri ArcGIS World Street Map** | `server.arcgisonline.com/.../World_Street_Map` | Default street basemap tiles |
| **Esri World Imagery** | `server.arcgisonline.com/.../World_Imagery` | Satellite basemap tiles |
| **Esri World Boundaries & Places** | `server.arcgisonline.com/.../World_Boundaries_and_Places` | Labels overlay for hybrid view |
| **Esri Geocoding (World GeocodeServer)** | `geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer` | Forward place search + reverse geocoding |
| **Leaflet** | `unpkg.com/leaflet@1.9.4` | Map library, loaded from CDN at runtime |
| **Google Fonts** | via `next/font/google` | Geist & Geist Mono |

> Esri tiles/geocoding are used because they are keyless, cover Nigeria well, and send permissive CORS headers. `.env.example` still lists legacy `GOOGLE_MAPS_*` variables — **they are unused**; the app needs no map key.

### Browser platform APIs (no libraries)
- **IndexedDB** — offline incident cache + outbox (`src/lib/idb.ts`).
- **Geolocation API** — device GPS.
- **Fetch + EventSource** — REST calls and the SSE live feed.
- **`navigator.onLine` / online-offline events** — connectivity detection.

### Server platform APIs (Node `crypto`)
- **`scrypt`** — password hashing.
- **`randomBytes`** — salts and session tokens.
- **`timingSafeEqual`** — constant-time password comparison.

---

## Architecture

```
                         ┌──────────────────────────── browser ────────────────────────────┐
                         │                                                                  │
   /  Reporter page ─────┤  MapPicker (Leaflet) ──► Esri tiles + geocoder                   │
   /login /setup         │  IndexedDB: incidents cache + outbox  ◄── sync on 'online'        │
   /admin (admin only)   │  EventSource ◄──────── SSE media stream                           │
                         └───────┬───────────────────────────────┬──────────────────────────┘
                                 │ fetch (JSON, session cookie)  │ text/event-stream
                         ┌───────▼───────────────────────────────▼──────────────────────────┐
                         │            Next.js route handlers (nodejs runtime)                │
                         │   /api/auth/*        /api/incidents/*                             │
                         │   auth/dal (session lookup) · incidents-dal (authorization)       │
                         └───────┬───────────────────────────────┬──────────────────────────┘
                                 │                               │
                         ┌───────▼────────┐              ┌───────▼────────┐
                         │ users.json     │              │ incidents.json │
                         │ sessions.json  │              │ (data/)        │
                         └────────────────┘              └────────────────┘
                          atomic writes + per-file lock (src/lib/store.ts)
```

- The **client** owns location UI, offline queueing, and rendering.
- The **server** owns validation, persistence, authorization, and the SSE feed.
- **`src/proxy.ts`** runs before matching routes for redirect convenience only (cookie presence); it deliberately performs **no** real authorization.

---

## Project structure

```
.
├── data/                      # file-backed store (runtime data)
│   ├── incidents.json         # all reports
│   ├── sessions.json          # active sessions (git-ignored)
│   └── users.json             # accounts (preloaded admin)
├── public/                    # static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx         # root layout, fonts, metadata
│   │   ├── globals.css        # Tailwind + theme variables
│   │   ├── page.tsx           # reporter home (SOS, map, my reports)
│   │   ├── login/page.tsx     # sign in / register
│   │   ├── setup/page.tsx     # first-time admin setup
│   │   ├── admin/
│   │   │   ├── page.tsx       # server guard (auth + role)
│   │   │   └── dashboard.tsx  # admin triage UI (client)
│   │   └── api/
│   │       ├── auth/{login,logout,me,register,setup,status}/route.ts
│   │       └── incidents/
│   │           ├── route.ts           # GET (admin) / POST (public)
│   │           ├── mine/route.ts      # GET own reports
│   │           ├── stream/route.ts    # GET SSE live feed (admin)
│   │           └── [id]/route.ts      # GET / PATCH / DELETE
│   ├── components/
│   │   ├── sos-button.tsx         # pulsing SOS button
│   │   ├── leaflet-map.tsx        # interactive picker (click/drag/GPS/search)
│   │   └── leaflet-map-view.tsx   # read-only report map (admin)
│   ├── hooks/
│   │   ├── use-incidents.ts       # fetch + SSE subscription
│   │   └── use-online.ts          # connectivity hook
│   ├── lib/
│   │   ├── store.ts               # atomic JSON read/write + per-file lock
│   │   ├── db.ts                  # incidents store
│   │   ├── users.ts               # user store + createUser
│   │   ├── sessions.ts            # session create/find/delete
│   │   ├── incidents-dal.ts       # view/delete/triage authorization
│   │   ├── idb.ts                 # IndexedDB wrappers
│   │   ├── sync.ts                # outbox flush
│   │   ├── esri.ts                # tile sources + geocoding
│   │   ├── ids.ts / time.ts       # id and ISO-time helpers
│   │   └── auth/
│   │       ├── password.ts        # scrypt hash + verify
│   │       └── dal.ts             # getCurrentUser, 401/403 helpers
│   ├── types/                 # auth, incident, leaflet types
│   └── proxy.ts               # route redirect proxy (cookie presence only)
├── .env.example
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── package.json
```

---

## Data model

`src/types/incident.ts`

```ts
type EmergencyType = "medical" | "fire" | "accident" | "theft" | "assault" | "other";
type IncidentStatus = "pending" | "acknowledged" | "in_progress" | "resolved" | "false_alarm";
type LocationSource = "device_gps" | "geocode" | "manual";

interface Incident {
  id: string;
  emergencyType: EmergencyType;
  description: string | null;
  location: { coords: GeoCoords | null; address: string | null; description: string | null; source: LocationSource };
  ownerId: string | null;      // null for anonymous reports
  reportedBy: string | null;
  contact: string | null;
  status: IncidentStatus;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string; updatedAt: string;
  acknowledgedAt: string | null; resolvedAt: string | null;
  assignedTo: string | null;
  notes: string[];             // activity log (status changes + admin notes)
}
```

`src/types/auth.ts`

```ts
type Role = "reporter" | "admin";
interface User { id; email; name; passwordHash; role; createdAt }   // stored
type SafeUser = Omit<User, "passwordHash">                            // returned to clients
interface Session { token; userId; createdAt; expiresAt }
```

---

## API reference

All handlers run on the **Node.js runtime** and return JSON. Auth uses the `sos_session` httpOnly cookie.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/auth/status` | public | `{ needsSetup: boolean }` — true when no users exist |
| `POST` | `/api/auth/setup` | public (only if no users) | Creates the first **admin** account |
| `POST` | `/api/auth/register` | public | Creates a **reporter** account |
| `POST` | `/api/auth/login` | public | Verifies credentials, starts a session |
| `POST` | `/api/auth/logout` | any | Deletes the session and clears the cookie |
| `GET` | `/api/auth/me` | any | Current `SafeUser` or `401` |
| `POST` | `/api/incidents` | **public** | Submit a report (optionally attributed if signed in) |
| `GET` | `/api/incidents` | admin | All reports |
| `GET` | `/api/incidents/mine` | signed-in | Reports owned by the current user |
| `GET` | `/api/incidents/[id]` | owner or admin | A single report |
| `PATCH` | `/api/incidents/[id]` | owner/admin (see below) | Update status/priority/notes (admin) or own details/location (owner) |
| `DELETE` | `/api/incidents/[id]` | owner or admin | Delete a report |
| `GET` | `/api/incidents/stream` | admin | SSE feed, pushes `{ incidents }` every 2s |

---

## Authentication & authorization

- **Password hashing:** `scrypt` with `N=16384, r=8, p=1`, 64-byte key, 16-byte random salt, encoded as `scrypt$N$r$p$salt$key` (`src/lib/auth/password.ts`).
- **Timing safety:** login always runs a `scrypt` verification — even for unknown emails — and compares with `timingSafeEqual`, so response timing doesn't reveal which emails exist.
- **Sessions:** 32-byte `base64url` tokens with a **7-day TTL**, stored in `sessions.json`; expired sessions are pruned on write.
- **Cookie:** `sos_session` — `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`.
- **Roles:**
  - `reporter` — sees/edits/deletes only their own reports.
  - `admin` — sees all reports, triages status/priority/notes, deletes anything.
- **Enforcement:** `src/lib/incidents-dal.ts` centralises `canView` / `canDelete` / `canTriage`, and every route handler re-checks. `src/proxy.ts` only checks that a cookie **exists** for `/admin/*` redirects and never authorises.
- **Anonymous alerts:** `POST /api/incidents` does not require a session; `ownerId` is `null` and the report can only be managed by an admin.

---

## Offline-first design

1. When offline, `POST`ing a report is replaced by writing it to the IndexedDB **outbox** and the local **incidents** cache (same id).
2. `useOnline()` watches `online`/`offline` events.
3. On reconnect, `syncOutbox()` flushes queued reports to `/api/incidents`:
   - `2xx` → outbox entry removed, placeholder swapped for the server record.
   - `401/403` → entry dropped (it will never be accepted in that auth state).
   - other errors / network → retry count incremented and retried later.
4. Queued reports can be **withdrawn** before they are sent.

---

## Maps & geocoding

- Leaflet 1.9.4 loads from `unpkg` on demand (`loadLeaflet()`), avoiding an npm dependency.
- Basemaps: **street**, **satellite**, **hybrid** (satellite + place labels) via Esri tiles. Esri uses `{z}/{y}/{x}` tile ordering (unlike the common `{z}/{x}/{y}`).
- **Reverse geocoding** debounces ~450 ms after the marker moves to label the point.
- **Forward search** is restricted to Nigeria and biased toward the campus centre `8.8475, 7.8758` (zoom 16).

---

## Installation

### Prerequisites
- **Node.js 18+** (developed on Node 24)
- **npm** (a `package-lock.json` is committed)

### Steps

```bash
# 1. Clone
git clone https://github.com/muhammad-kanti/final-project.git
cd final-project

# 2. Install dependencies
npm install

# 3. (Optional) environment file — no keys are required
cp .env.example .env.local

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000.

### Environment variables

**None are required.** Maps and geocoding use keyless Esri services. `.env.example` retains `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_API_KEY` from an earlier iteration, but no code reads them.

### Production build

```bash
npm run build
npm run start        # serves the production build on :3000
```

---

## First-time setup & accounts

There are two ways to get an admin account:

1. **In-app setup** — if no users exist, visit `/setup` (or follow the prompt on `/login`) to create the first admin.
2. **Preloaded account** — the repository ships `data/users.json` containing:
   - **admin:** `admin@nsuk.edu.ng` / `password123`  ← **change this immediately**
   - plus demo reporter accounts (`alice@`, `bob@`, `dicco@`).

Then:
- **Reporters** sign in or register at `/login`.
- **Admins** land on `/admin` after signing in.

> The setup endpoint is disabled once any user exists (`needsSetup` becomes false).

---

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server (with hot reload) |
| `npm run build` | Create an optimised production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint (`eslint-config-next`) |

Type-checking: `npx tsc --noEmit`.

---

## Data storage & resetting

All persistence is plain JSON under `data/`, written atomically (temp file + rename) with a per-file lock to prevent concurrent clobbering (`src/lib/store.ts`).

| File | Contents | Tracked in git? |
| --- | --- | --- |
| `data/incidents.json` | All reports | yes |
| `data/users.json` | Accounts (password hashes) | yes |
| `data/sessions.json` | Active sessions | no (git-ignored) |

**Reset to a clean slate** while keeping accounts:

```bash
printf '{\n  "incidents": []\n}\n' > data/incidents.json
printf '{\n  "sessions": []\n}\n'  > data/sessions.json
```

Delete `data/users.json` entirely to force first-time setup again.

---

## Security notes

- Passwords are stored only as salted `scrypt` hashes; never logged or returned (`toSafeUser` strips the hash).
- Session cookies are `httpOnly` + `sameSite=lax`; set `secure` in production.
- Server-only modules import `server-only` so secrets can't leak into the client bundle.
- Unknown-email logins perform a dummy hash verification to avoid user enumeration.
- The bundled `data/users.json` publishes a known demo password — rotate it before any real use.

---

## Production considerations

This is a demo/course project. Before real deployment:

- **Replace the JSON store** with a real database (PostgreSQL/SQLite + Prisma/Drizzle). The JSON store assumes a single process and local disk; it won't survive serverless/multi-instance deployments.
- **Move sessions to a shared store** (DB/Redis) for the same reason.
- **Rotate and secure secrets**, and never commit `users.json`/`sessions.json` with real credentials.
- The **SSE feed polls the store every 2s**; for scale, push changes from the data layer instead.
- Add rate limiting on `POST /api/incidents` and the auth endpoints.
- Restrict/attribute the third-party tile and geocoding services for high-traffic use.
