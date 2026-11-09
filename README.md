# TravelMate frontend

Next.js 14 (App Router) · TypeScript · Tailwind CSS · TanStack Query · Zustand · Socket.io client.

## Run
```bash
npm install
cp .env.example .env.local   # leave NEXT_PUBLIC_API_URL empty to use mock data
npm run dev                  # http://localhost:3000
```
In mock mode any valid email plus an 8+ character password signs you in.

## Connect the real API
1. Set `NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_USE_MOCK=false`) in `.env.local`.
2. Implement the endpoints in `docs/API_CONTRACT.md`. All frontend calls are in `src/lib/api.ts`.
3. Allow the frontend origin in Express CORS (`credentials` not needed; the JWT is sent as a Bearer header).

## Structure
```
src/app/login                 Sign in / sign up
src/app/(app)/discover        Match grid + "Up next" card
src/app/(app)/trips/new       New trip form
src/app/(app)/messages        Conversation list + chat (Socket.io)
src/app/(app)/groups          Trip groups, join/leave, new group
src/app/(app)/profile         Profile, hide contact info
src/app/(app)/admin           Report moderation (admin role only)
src/lib/api.ts                All backend calls (+ mock switch)
src/lib/mock.ts               Mock data
src/types/index.ts            Types generated from the ERD
```

## Not built yet
Group chat screen, another traveler's profile, chat-request accept/decline UI, OAuth callback page,
real photos (placeholders are generated gradients and initials), tests.
