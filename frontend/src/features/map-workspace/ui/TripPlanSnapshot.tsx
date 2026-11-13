import type { Trip } from '@trasolve/shared';
import { useL } from '@/shared/i18n';

export function TripPlanSnapshot({ trip }: { trip: Trip }) {
  const L = useL();
  return (
    <section>
      <h3>{trip.title}</h3>
      <ol>
        {trip.days.map((day) => (
          <li key={day.id}>
            <strong>{day.title}</strong>
            <ol>
              {day.places.map((place) => (
                <li key={place.id}>
                  <strong>{place.name}</strong>
                  {place.address && <p>{place.address}</p>}
                  <dl>
                    <dt>{L('place:placeDetailContent.title.memo')}</dt>
                    <dd>
                      {place.memo ??
                        L('place:placeDetailContent.description.noNotes')}
                    </dd>
                    <dt>
                      {L('map:tripCommandPlanAdapter.error.visitStartTime')}
                    </dt>
                    <dd>
                      {place.time ??
                        L('place:placeDurationControl.text.notSet')}
                    </dd>
                    <dt>
                      {L('map:tripCommandPlanAdapter.error.durationVisit')}
                    </dt>
                    <dd>
                      {place.visitDurationMinutes === undefined
                        ? L('place:placeDurationControl.text.notSet')
                        : L(
                            'place:placeDuration.formatDurationMinutes.text.minutes',
                            { minutes: place.visitDurationMinutes },
                          )}
                    </dd>
                    <dt>
                      {L('place:placeDetailContent.title.desiredStayTime')}
                    </dt>
                    <dd>
                      {place.preferredDurationMinutes === undefined
                        ? L('place:placeDurationControl.text.notSet')
                        : L(
                            'place:placeDuration.formatDurationMinutes.text.minutes',
                            { minutes: place.preferredDurationMinutes },
                          )}
                    </dd>
                  </dl>
                </li>
              ))}
            </ol>
            <ol>
              {day.polylines.map((polyline) => (
                <li key={polyline.id}>
                  {
                    day.places.find(
                      (place) => place.id === polyline.fromPlaceId,
                    )?.name
                  }{' '}
                  →{' '}
                  {
                    day.places.find((place) => place.id === polyline.toPlaceId)
                      ?.name
                  }
                  <p>
                    {polyline.mode === 'straight'
                      ? L(
                          'map:polylineMode.pOLYLINEMODEOPTIONS.label.straightLine',
                        )
                      : polyline.mode === 'walking'
                        ? L('map:polylineMode.pOLYLINEMODEOPTIONS.label.walk')
                        : polyline.mode === 'transit'
                          ? L(
                              'map:polylineMode.pOLYLINEMODEOPTIONS.label.publicTransportation',
                            )
                          : L('map:polylineMode.pOLYLINEMODEOPTIONS.label.car')}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}
