# Horizon Trip Planner

Horizon is a map-first trip planning app for building multi-day travel itineraries.

You can search and pin places, assign them to specific days, order stops in a schedule, set stay durations and travel modes, and view route/distance/time estimates on an interactive map.

## What the app does

- Manage multiple trips (create, rename, delete, switch)
- Plan trips across multiple days
- Search destinations with Mapbox and pin custom map locations
- Categorize saved places (stay, eat, coffee, attraction, landmark, shopping, nature, transport, other)
- Add pinned places to one or more days
- Build ordered day itineraries with:
  - start/departure time
  - per-stop stay durations
  - commute mode between stops (driving, transit estimate, walking, bicycle)
- Visualize stops and routes on a Leaflet map
- See quick trip stats (stops, distance, travel/stay time)
- Persist all trip data in browser local storage

## Common use cases

- **Vacation planning:** Build a realistic day-by-day schedule before a trip
- **City exploration:** Organize restaurants, landmarks, and activities by day
- **Road trip drafting:** Compare route order, distances, and expected travel time
- **Weekend itinerary sharing:** Create a structured plan for friends/family
- **On-the-fly planning:** Drop map pins quickly when you discover places

## Tech stack

- React 19 + TypeScript
- Vite
- Leaflet (map rendering)
- Mapbox APIs (search, geocoding, directions)
- Lucide icons
- Oxlint

## Getting started

### 1) Install dependencies

```bash
npm ci
```

### 2) Configure environment

Create a `.env` file in the project root:

```env
VITE_MAPBOX_TOKEN=your_mapbox_access_token_here
```

Mapbox is required for full search, geocoding, and directions functionality.

### 3) Run the app

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
```

### 5) Lint

```bash
npm run lint
```

## Scripts

- `npm run dev` - start Vite dev server with hot reload
- `npm run build` - TypeScript build + Vite production build
- `npm run preview` - preview production build
- `npm run lint` - run oxlint

## How planning works

- Trips contain:
  - saved locations
  - one or more days
  - per-day itinerary entries that reference saved locations
- Routing is computed between consecutive itinerary stops
- Transit mode uses estimation fallback
- Data persists in browser `localStorage` (`horizon_trips`, `horizon_active_trip_id`)

## Notes

- If Mapbox token is missing, search/routing features are limited.
- The app is client-side only (no backend/database by default).
