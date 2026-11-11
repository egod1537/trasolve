import type { Trip } from '@trasolve/shared';
import { resolvePlaceStyle } from '@/entities/place';
import { defineTripCommand } from '../command/TripCommand';
import type { TripEditController } from '../controller/TripEditController';
import type { useMapWorkspace } from '../model/useMapWorkspace';
import type { CommandHandlers } from './commandRuntime';
import {
  clockMinutes,
  colorValue,
  resolveDay,
  resolvePlace,
} from './commandTargets';
export type EditCommandContext = {
  trip: Trip;
  controller: TripEditController;
  ui: ReturnType<typeof useMapWorkspace>;
  currentTrip: () => Trip;
};
export function createEditCommands(ctx: EditCommandContext): CommandHandlers {
  const { trip, controller, ui } = ctx;
  const day = (value?: string | number) =>
    resolveDay(trip, value, ui.selectedDayId);
  const place = (value?: string | number) =>
    resolvePlace(trip, value, ui.selectedPlaceId);
  const change = async (operation: Promise<boolean>) => {
    if (!(await operation)) {
      throw new Error('CHANGE_REJECTED');
    }
    return { data: { applied: true, saved: false } };
  };
  const visibility = (value: string | number | undefined, hidden: boolean) => {
    const ids = new Set(
      String(value) === 'all' ? trip.days.map((d) => d.id) : [day(value).id],
    );
    return change(
      controller.executeBatch([
        defineTripCommand((draft) => {
          for (const d of draft.days) {
            if (ids.has(d.id)) {
              d.hidden = hidden;
            }
          }
          return draft;
        }),
      ]),
    );
  };
  return {
    'trip rename': (a) => change(controller.renameTrip(String(a.title))),
    'day list': () => ({
      items: trip.days.map((d) => ({
        label: d.title,
        detail: String(d.places.length),
        command: { name: 'day select', args: { day: d.id } },
      })),
      data: trip.days.map((d, i) => ({
        index: i + 1,
        id: d.id,
        title: d.title,
        places: d.places.length,
        hidden: !!d.hidden,
      })),
    }),
    'day add': (a) => change(controller.addDay(String(a.title))),
    'day select': (a) => {
      const target = day(a.day);
      if (target.hidden) {
        throw new Error('DAY_HIDDEN');
      }
      ui.selectDay(target.id);
      ui.focusDay(target.id);
      return { data: { dayId: target.id } };
    },
    'day rename': (a) =>
      change(controller.renameDay(day(a.day).id, String(a.title))),
    'day move': (a) => {
      if (Number(a.order) > trip.days.length) {
        throw new Error('INVALID_ORDER');
      }
      return change(controller.moveDay(day(a.day).id, Number(a.order) - 1));
    },
    'day show': (a) => visibility(a.day, false),
    'day hide': (a) => visibility(a.day, true),
    'day color': (a) =>
      change(controller.updateDayColor(day(a.day).id, colorValue(a.color))),
    find: (a) => {
      const query = String(a.query).normalize('NFKC').toLocaleLowerCase();
      return {
        items: trip.days.flatMap((d) =>
          d.places
            .filter((p) =>
              [p.name, p.memo, p.address].some((v) =>
                v?.normalize('NFKC').toLocaleLowerCase().includes(query),
              ),
            )
            .map((p) => ({
              label: p.name,
              detail: d.title,
              command: { name: 'place select', args: { place: p.id } },
            })),
        ),
      };
    },
    'place rename': (a) =>
      change(
        controller.updatePlace(place(a.place).id, { name: String(a.title) }),
      ),
    'place move': (a) => {
      const p = place(a.place);
      const target = day(a.day);
      const count = target.places.filter((item) => item.id !== p.id).length;
      const order = a.order === undefined ? count : Number(a.order) - 1;
      if (order > count) {
        throw new Error('INVALID_ORDER');
      }
      return change(controller.movePlace(p.id, target.id, order));
    },
    'place time': (a) => {
      const start = clockMinutes(String(a.start));
      const end = clockMinutes(String(a.end));
      if (end <= start || start % 10 || end % 10) {
        throw new Error('INVALID_VISIT_RANGE');
      }
      return change(
        controller.updateVisitTimeRange(
          place(a.place).id,
          String(a.start),
          end - start,
        ),
      );
    },
    'place memo': (a) =>
      change(controller.updateMemo(place(a.place).id, String(a.memo))),
    'place color': (a) => {
      const p = place(a.place);
      const d = trip.days.find((d) => d.places.some((p2) => p2.id === p.id))!;
      return change(
        controller.updatePlaceStyle(p.id, {
          ...resolvePlaceStyle(p.placeStyle, d.color),
          color: colorValue(a.color),
        }),
      );
    },
    'place remove': (a) => change(controller.removePlace(place(a.place).id)),
    'route mode': (a) => {
      const ids =
        a.day === undefined
          ? ui.selectedPolylineIds
          : new Set(day(a.day).polylines.map((p) => p.id));
      if (!ids.size) {
        throw new Error('ROUTE_REQUIRED');
      }
      return change(
        controller.updatePolylineModes(
          [...ids],
          String(a.mode) as 'walking' | 'transit' | 'driving' | 'straight',
        ),
      );
    },
    undo: () => change(controller.undo()),
    redo: () => change(controller.redo()),
  };
}
