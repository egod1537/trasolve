import type { Trip, TripDay, TripPlace } from '@trasolve/shared';
import { formatDurationMinutes } from '@/shared/i18n/formatters';
import { getLanguage, L, NL } from '@/shared/i18n';
import { formatPolylineMode } from '../lib/mapFormatters';
import printCss from './trip-schedule-print.css?inline';

function SchedulePlace({ place, index }: { place: TripPlace; index: number }) {
  const duration = place.preferredDurationMinutes ?? place.visitDurationMinutes;
  const mapsUrl = new URL('https://www.google.com/maps/search/');
  mapsUrl.searchParams.set('api', '1');
  mapsUrl.searchParams.set(
    'query',
    place.placeId ? place.name : `${place.location.lat},${place.location.lng}`,
  );
  if (place.placeId) {
    mapsUrl.searchParams.set('query_place_id', place.placeId);
  }
  return (
    <article className="schedule-place">
      <header>
        <div className="schedule-time">
          <strong>{place.time ?? '—'}</strong>
          <span className="schedule-number">{index}</span>
        </div>
        <div className="schedule-place-heading">
          <h3>
            <a href={mapsUrl.href}>{place.name}</a>
          </h3>
          {place.address && <p>{place.address}</p>}
        </div>
        {duration !== undefined && (
          <span
            className="schedule-stay"
            title={L('place:placeDetailContent.title.desiredStayTime')}
          >
            {formatDurationMinutes(duration)}
          </span>
        )}
      </header>
      {place.memo && (
        <div className="schedule-memo">
          <strong>{L('place:placeDetailContent.title.memo')}</strong>
          <p>{place.memo}</p>
        </div>
      )}
    </article>
  );
}

function ScheduleDay({ day }: { day: TripDay }) {
  const places = new Map(day.places.map((place) => [place.id, place]));
  const routes = new Map(day.polylines.map((route) => [route.id, route]));
  let placeIndex = 0;
  return (
    <section className="schedule-day">
      <header className="schedule-day-heading">
        <div>
          <h2>{day.title}</h2>
          {day.date && <p>{day.date}</p>}
        </div>
        <span>
          {L('map:bottomContextPanel.text.locations', {
            length: day.places.length,
          })}
        </span>
      </header>
      {!day.places.length && (
        <p className="schedule-empty">
          {L('map:dayLayerSection.text.thereNoRegisteredItems')}
        </p>
      )}
      {day.layerItems.map((item) => {
        if (item.type === 'place') {
          const place = places.get(item.id);
          return place ? (
            <SchedulePlace key={item.id} place={place} index={++placeIndex} />
          ) : null;
        }
        const route = routes.get(item.id);
        if (!route) {
          return null;
        }
        const from = places.get(route.fromPlaceId);
        const to = places.get(route.toPlaceId);
        return from && to ? (
          <p key={item.id} className="schedule-connection">
            <strong>{formatPolylineMode(route.mode)}</strong>
            <span>
              {from.name} → {to.name}
            </span>
          </p>
        ) : null;
      })}
    </section>
  );
}

/** A standalone print document; React escapes every user-entered value. */
export function TripScheduleDocument({
  trip,
}: {
  trip: Pick<Trip, 'title' | 'days'>;
}) {
  return (
    <html lang={getLanguage()}>
      <head>
        <meta charSet="utf-8" />
        <title>{trip.title}</title>
        <style>{printCss}</style>
      </head>
      <body>
        <header className="schedule-document-heading">
          <span>{NL('Trasolve')}</span>
          <h1>{trip.title}</h1>
          <p>{L('map:layerPanel.ariaLabel.travelItinerary')}</p>
        </header>
        <main>
          {trip.days.map((day) => (
            <ScheduleDay key={day.id} day={day} />
          ))}
        </main>
      </body>
    </html>
  );
}
