# Trip Planner Workspace Guidelines

This project includes a dummy data seeding utility to allow quick local testing of new features and git worktrees.

## Maintaining Demo Data
When modifying the data model (e.g. adding or changing fields in `Trip`, `Location`, `ItineraryItem`, or `TripDay` in `src/types/index.ts`):
1. **TypeScript Type Safety**: The demo trip generator `generateDemoTrip` in `src/utils/dummyData.ts` is strongly typed. TypeScript will fail compilation during `npm run build` if any mandatory schema fields are missing.
2. **Update Demo Values**: If you add new optional or feature-specific fields (e.g., location notes, lodging rates, or budget tracking), you should update the demo trip in `src/utils/dummyData.ts` to populate these fields with realistic demo values. This ensures that new features can be visualised and tested instantly in worktrees.
3. **Verify Build & Lint**: Always verify that the build (`npm run build`) and linter (`npm run lint`) pass after changing schemas or dummy data.

## TypeScript Imports (`verbatimModuleSyntax`)
- The project has `verbatimModuleSyntax` enabled in `tsconfig.json`.
- You **must** use type-only imports (`import type { ... } from '...'`) when importing TypeScript interfaces, types, or enums. Mixing type imports with value imports or importing types without the `type` keyword will cause compilation failures during `npm run build`.

## Git Worktree and Environment Setup
- The project automatically copies the parent clone's `.env` configuration file to new Git worktrees when you run `npm run dev` or `npm run build` using the custom script `scripts/setup-worktree.js`.
- **Never commit `.env` or personal credential files to Git**. Keep them ignored via `.gitignore`.
- Run `npm ci` or `npm install` after checking out a new worktree to ensure dependencies are resolved correctly.

## Routing and Mapbox API Fallbacks
- The map relies on Mapbox Geocoding and Directions APIs.
- When writing features related to routing (e.g., in `src/App.tsx` or `src/components/MapComponent.tsx`), always preserve and maintain the **Haversine straight-line estimation fallback**. If a developer or worktree does not have a valid `VITE_MAPBOX_TOKEN` configured, the application must degrade gracefully to straight-line distance calculations so it remains functional.

## Code Quality and Linting
- The project uses `oxlint` for linting. It is extremely fast and checks for a variety of React hooks issues, syntax correctness, and TypeScript conventions.
- Always run `npm run lint` before committing or requesting reviews.
