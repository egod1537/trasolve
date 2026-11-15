import type { Trip } from '@trasolve/shared';

/** Open synchronously inside the user's click, then render the immutable snapshot. */
export async function printTripSchedule(
  trip: Pick<Trip, 'title' | 'days'>,
): Promise<void> {
  const popup = window.open('', '_blank');
  if (!popup) {
    throw new Error('PRINT_WINDOW_UNAVAILABLE');
  }
  popup.opener = null;
  const snapshot = structuredClone(trip);
  try {
    const [
      { renderToStaticMarkup },
      { TripScheduleDocument },
      { createElement },
    ] = await Promise.all([
      import('react-dom/server'),
      import('./TripScheduleDocument'),
      import('react'),
    ]);
    if (popup.closed) {
      return;
    }
    popup.document.open();
    popup.document.write(
      '<!doctype html>' +
        renderToStaticMarkup(
          createElement(TripScheduleDocument, { trip: snapshot }),
        ),
    );
    popup.document.close();
    await popup.document.fonts.ready;
    if (popup.closed) {
      return;
    }
    popup.focus();
    popup.print();
  } catch (error) {
    popup.close();
    throw error;
  }
}
