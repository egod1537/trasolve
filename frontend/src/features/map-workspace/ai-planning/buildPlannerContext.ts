import type { TripPolylineMode } from '@trasolve/shared';
import {
  plannerContextSchema,
  PLANNER_CONTEXT_VERSION,
  type PlannerContext,
  type PlannerConstraintInput,
  type PlannerUserPreferenceInput,
  type PlannerExternalEvidenceInput,
  type PlannerMissingUnknownInput,
} from './types/plannerContext';

// Structural input shape, deliberately looser than `@trasolve/shared`'s
// `Trip`/`TripInput`: both already satisfy it, so callers can pass either the
// live persisted Trip or a pre-persistence input without adapting it. Only
// the fields PlannerContext actually needs are declared here.
export interface PlannerTripSnapshotPlace {
  id: string;
  placeId?: string | null;
  name: string;
  address?: string | null;
  location: { lat: number; lng: number };
  memo?: string | null;
  visitDurationMinutes?: number | null;
  preferredDurationMinutes?: number | null;
  time?: string | null;
  order: number;
  openingHours?: unknown;
}

export interface PlannerTripSnapshotRouteSegment {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  order: number;
  mode: TripPolylineMode;
}

export interface PlannerTripSnapshotDay {
  id: string;
  title: string;
  date?: string | null;
  places: readonly PlannerTripSnapshotPlace[];
  polylines: readonly PlannerTripSnapshotRouteSegment[];
}

export interface PlannerTripSnapshot {
  id?: string | null;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  updatedAt?: string | null;
  days: readonly PlannerTripSnapshotDay[];
}

// Mirrors the current-Day/current-Place(s)/current-Polyline(s) selection
// concepts already tracked by `useActiveDay`/`useMapSelection` in
// map-workspace. Selection is read here, never queried later -- a proposal
// consumer must not re-read mutable UI state.
export interface PlannerSelectionInput {
  dayId?: string | null;
  placeIds?: readonly string[];
  polylineIds?: readonly string[];
}

export interface PlannerSourceInput {
  tripId?: string | null;
  // Opaque provenance/staleness value. This builder never computes one; see
  // the module doc comment below for why it is not owned here.
  snapshotToken?: string | null;
}

export interface BuildPlannerContextInput {
  trip: PlannerTripSnapshot;
  selection?: PlannerSelectionInput | null;
  userInstruction?: string | null;
  constraints?: readonly PlannerConstraintInput[];
  userPreferences?: readonly PlannerUserPreferenceInput[];
  externalEvidence?: readonly PlannerExternalEvidenceInput[];
  missingUnknown?: readonly PlannerMissingUnknownInput[];
  source?: PlannerSourceInput | null;
}

// Pure, deterministic, provider-independent transform from current Trip
// state (plus caller-supplied constraints/preferences/evidence/selection)
// into a validated PlannerContext. Never mutates `input.trip`, never calls a
// model, provider, or persistence layer, and never fetches Places/Routes.
export function buildPlannerContext(
  input: BuildPlannerContextInput,
): PlannerContext {
  const { trip } = input;

  const days = trip.days.map((day, dayIndex) => ({
    id: day.id,
    title: day.title,
    date: day.date ?? null,
    // Days carry no persisted `order` field; this reflects the Trip's
    // existing array position, which is the product's real ordering
    // semantic today (see shared/schemas/trip.ts tripDaySchema).
    order: dayIndex + 1,
    places: day.places.map((place) => ({
      id: place.id,
      googlePlaceId: place.placeId ?? null,
      name: place.name,
      location: { lat: place.location.lat, lng: place.location.lng },
      order: place.order,
      scheduledTime: place.time ?? null,
      visitDurationMinutes: place.visitDurationMinutes ?? null,
      preferredDurationMinutes: place.preferredDurationMinutes ?? null,
      memo: place.memo ?? null,
      address: place.address ?? null,
      openingHoursKnown: place.openingHours != null,
    })),
    routeSegments: day.polylines.map((polyline) => ({
      id: polyline.id,
      fromPlaceId: polyline.fromPlaceId,
      toPlaceId: polyline.toPlaceId,
      order: polyline.order,
      mode: polyline.mode,
    })),
  }));

  const rawContext = {
    contextVersion: PLANNER_CONTEXT_VERSION,
    tripFact: {
      id: trip.id ?? null,
      title: trip.title,
      startDate: trip.startDate ?? null,
      endDate: trip.endDate ?? null,
      updatedAt: trip.updatedAt ?? null,
      days,
    },
    selectedScope: input.selection
      ? {
          dayId: input.selection.dayId ?? null,
          placeIds: [...(input.selection.placeIds ?? [])],
          polylineIds: [...(input.selection.polylineIds ?? [])],
        }
      : null,
    source: {
      tripId: input.source?.tripId ?? trip.id ?? null,
      snapshotToken: input.source?.snapshotToken ?? null,
    },
    userInstruction: input.userInstruction ?? null,
    knownConstraints: input.constraints ?? [],
    userPreferences: input.userPreferences ?? [],
    externalEvidence: input.externalEvidence ?? [],
    missingUnknown: input.missingUnknown ?? [],
  };

  return plannerContextSchema.parse(rawContext);
}

// Fingerprint/staleness-anchor note (Slice 3 architecture-sync topic):
//
// `source.snapshotToken` exists only as an opaque pass-through slot. Travel
// Planning does not compute it and does not define its algorithm here. A
// separate stale-plan fingerprint mechanism exists on the TripCommand
// branch; this module deliberately does not import or reimplement it. When
// a caller has such a token (e.g. from that mechanism, once the two branches
// are synced), it can be passed in via `source.snapshotToken` and will be
// carried through PlannerContext unchanged. Until that sync happens, this
// field is expected to remain null in practice.
