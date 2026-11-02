# Trasolve

**Find places with AI, then figure out how to get to them.**

Trasolve is a travel planner that brings place discovery, trip planning, and route optimization together on a map. The goal is to turn a list of places you want to visit into a trip you can actually follow.

> [!NOTE]
> Trasolve is still in development. Some parts of the planning flow are unfinished and may change.

[Try Trasolve](https://trasolve.mangagaki.net) · [Route optimization engine (troute)](https://github.com/egod1537/troute)

<!-- Add a screenshot or short demo here. -->

## Why Trasolve?

Finding places to visit is easy. Fitting them into a day is harder.

A list of recommendations doesn't tell you which place to visit first, how long it takes to get between stops, or whether you'll arrive before a place closes. Trasolve is an attempt to handle those details in the same place where you explore and save destinations.

## Features

- **AI-assisted discovery** — Use the chat panel to explore places and travel ideas.
- **Map-based planning** — Find places on a map and organize stops into a trip.
- **Saved trips** — Create, edit, and return to your itineraries.
- **Route optimization (in progress)** — Work toward an itinerary that accounts for travel time and scheduling constraints. The optimization engine is developed separately in [troute](https://github.com/egod1537/troute).

## Getting Started

The development version is available at **[trasolve.mangagaki.net](https://trasolve.mangagaki.net)**.

The site is changing as features are built, so it may not always be usable end to end.

## Self-Hosting

The repository contains the frontend, backend, and shared API definitions. Route optimization is handled by the separate [`troute`](https://github.com/egod1537/troute) project.

For local development, you'll need Node.js 24.11 or newer. Start with the example environment files in the root, `frontend`, and `backend` directories, then run:

```bash
npm install
npm run dev
```

Additional services and API keys are needed for features such as maps, authentication, and persistence. See the documentation in [`docs/`](docs/) and the environment examples for configuration details. This is a development setup, not a one-command production deployment.
