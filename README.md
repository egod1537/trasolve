<p align="center">
  <img src="./frontend/public/favicon.svg" width="144" height="144" alt="Trasolve App Icon" />
</p>

<h1 align="center">Trasolve</h1>

<p align="center"><strong>Find places with AI. Plan how to get there.</strong></p>

<p align="center">
  <strong>Under Active Development</strong><br />
  <a href="https://trasolve.mangagaki.net">Open the demo</a>
</p>

<!--
Add the current application screenshot at docs/assets/trasolve-app.png, then enable this block:

<p align="center">
  <a href="https://trasolve.mangagaki.net">
    <img src="./docs/assets/trasolve-app.png" width="1200" alt="Trasolve map workspace" />
  </a>
</p>
-->

Trasolve is a trip-planning application with place search, itinerary editing, maps, and route tools. The project is still in development. Some features require external services or API credentials.

## Why Trasolve?

A list of places is not an itinerary. You still need to group stops by day, decide their order, and account for travel time and opening hours.

Trasolve keeps this work next to the map. You can search for places, organize them by day, review routes between stops, and use the chat panel for travel questions.

## Features

- Trips can contain multiple days, ordered places, schedule details, and routes displayed on a Google map.
- Place searches go through the backend to Google Places. A search result can be added directly to a trip.
- The backend stores trips and uses revisions to detect conflicting edits.
- The chat panel renders Markdown and can use OpenWebUI, Gemini, or the local development provider. It does not automatically change the active trip.
- Google Routes provides directions. Route optimization uses the separate [`troute`](https://github.com/egod1537/troute) service and is still under development.
- The interface supports localized resources and light, dark, and system themes.

## Getting Started

The hosted development build is available at [trasolve.mangagaki.net](https://trasolve.mangagaki.net).

Sign in, create a trip or load an example, then use the map workspace to search for places and arrange the itinerary. The hosted build changes frequently. Some flows may be incomplete or temporarily unavailable.

## Self-Hosting

Trasolve is a workspace-based TypeScript project with a React frontend, a Node.js backend, and shared runtime schemas. Local development requires Node.js 24.11 or newer.

Copy the frontend and backend environment examples before starting:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
npm install
npm run dev
```

The development servers run at `http://127.0.0.1:5173` for the frontend and `http://127.0.0.1:43127` for the backend. Local mode uses file persistence and supports debug guest authentication. A browser-restricted Maps JavaScript API key is required to render the map; Places and Routes use separate server-side keys.

AI chat, Google OAuth, PostgreSQL persistence, `troute`, and `tcache` are optional integrations with their own settings in the example environment files. The development-only random chat provider is used when no AI provider is configured. PostgreSQL users should configure `DATABASE_URL` and run `npm run db:migrate`.

Validate a production build with the repository scripts:

```bash
npm run typecheck
npm run lint
npm run build
```

Detailed implementation and deployment notes are kept in [`docs/architecture-and-operations.md`](docs/architecture-and-operations.md). Additional references include the [database guide](docs/database.md), [trip and map architecture](docs/trip-maps.md), and [frontend source layout](docs/frontend-source-layout.md).
