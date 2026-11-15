import { useState } from 'react';
import { workspaceCommandDefinitions, type Trip } from '@trasolve/shared';
import type { TripRepository } from '@/entities/trip';
import { TripDeleteConfirmation } from '../components/TripDeleteConfirmation';
import { resolveNamed } from './commandTargets';
import { useCommandBindings, useCommandRuntime } from './CommandProvider';
export function CatalogCommands({
  repository,
  selectedTrip,
  onSelect,
  onDelete,
  onCreated,
  onOpenPicker,
  readOnly,
}: {
  repository: TripRepository;
  selectedTrip: Trip | null;
  onSelect: (trip: Trip) => void;
  onDelete: (id: string) => void;
  onCreated: (id: string) => void;
  onOpenPicker: () => void;
  readOnly: boolean;
}) {
  const runtime = useCommandRuntime();
  const [deleting, setDeleting] = useState<Trip | null>(null);
  useCommandBindings({
    help: (a) => ({
      items: workspaceCommandDefinitions
        .filter((d) => !a.command || d.name.startsWith(String(a.command)))
        .map((d) => ({ label: d.name, detail: d.syntax })),
      data: workspaceCommandDefinitions
        .filter((d) => !a.command || d.name.startsWith(String(a.command)))
        .map((d) => ({
          name: d.name,
          syntax: d.syntax,
          available: runtime.available(d.name),
          effect: d.effect,
          arguments: d.fields,
        })),
    }),
    'trip list': async (_a, signal) => {
      const trips = await repository.listTrips(signal);
      return {
        items: trips.map((t) => ({
          label: t.title,
          detail: t.id,
          command: { name: 'trip open', args: { trip: t.id } },
        })),
      };
    },
    'trip open': async (a, signal) => {
      await runtime.beforeNavigate();
      signal.throwIfAborted();
      const trips = await repository.listTrips(signal);
      const found = resolveNamed(trips, String(a.trip), (t) => t.title);
      const trip = await repository.getTrip(found.id, signal);
      signal.throwIfAborted();
      onSelect(trip);
      return { data: { tripId: trip.id }, handoff: true };
    },
    ...(readOnly
      ? {}
      : {
          'trip new': async (a, signal) => {
            await runtime.beforeNavigate();
            signal.throwIfAborted();
            const trip = await repository.createTrip(
              { title: String(a.title), days: [] },
              signal,
            );
            signal.throwIfAborted();
            onSelect(trip);
            onCreated(trip.id);
            return { data: { tripId: trip.id }, handoff: true };
          },
          'trip delete': async (_a, signal) => {
            if (!selectedTrip) {
              throw new Error('TRIP_REQUIRED');
            }
            await runtime.beforeNavigate();
            const current = await repository.getTrip(selectedTrip.id, signal);
            signal.throwIfAborted();
            setDeleting(current);
            return { handoff: true };
          },
        }),
  });
  return deleting ? (
    <TripDeleteConfirmation
      trip={deleting}
      onCancel={() => setDeleting(null)}
      onConfirm={() => {
        onDelete(deleting.id);
        setDeleting(null);
        onOpenPicker();
      }}
    />
  ) : null;
}
