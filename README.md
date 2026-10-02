# NSUK Campus Emergency Response System

A real-time campus emergency response system for Nasarawa State University, Keffi (NSUK). It enables students/staff to report emergencies instantly with GPS/manual location, works offline via IndexedDB outbox, and provides a live admin dashboard with SSE.

## Tech
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Google Maps JavaScript API (client-side)
- IndexedDB (idb) for offline queue + local cache
- File-backed store (JSON) for API persistence (dev/demo)

## Setup
1. Copy `.env.example` to `.env.local`
2. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (and optional server key)
3. `npm install`
4. `npm run dev` → http://localhost:3000
5. Admin: http://localhost:3000/admin

## Features
- One-tap SOS with emergency type + details
- GPS, Places search, or manual location description
- Offline support: incidents queued in IndexedDB, auto-sync on reconnect
- Live updates via SSE
- Status tracking: pending/acknowledged/in_progress/resolved/false_alarm

## Notes
- For production, replace JSON file store with a proper DB (Postgres/SQLite/Prisma).
- Restrict Google Maps API key to your domain/referrers.
