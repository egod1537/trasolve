import { useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import type { Measurement } from './useMeasurement';
import {
  isSimplePolygon,
  polygonArea,
  segmentDistance,
} from './measurementGeometry';
import './measurement.css';

export function MeasurementPanel({
  measurement,
}: {
  measurement: Measurement;
}) {
  const L = useL();
  const { points, tool, clear, undo, selectTool } = measurement;
  if (tool === 'pan') {
    return null;
  }
  const distance = (value: number) =>
    value >= 1000
      ? L('map:measurement.kilometers', {
          value: (value / 1000).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          }),
        })
      : L('map:measurement.meters', {
          value: value.toLocaleString(undefined, { maximumFractionDigits: 1 }),
        });
  const segments = points
    .slice(1)
    .map((point, i) => segmentDistance(points[i], point));
  const area = polygonArea(points);
  const valid = isSimplePolygon(points);
  return (
    <section
      className="map-measurement-panel"
      aria-label={
        tool === 'distance'
          ? L('map:measurement.distance')
          : L('map:measurement.area')
      }
    >
      <strong>
        {tool === 'distance'
          ? L('map:measurement.distance')
          : L('map:measurement.area')}
      </strong>
      <p>{L('map:measurement.hint')}</p>
      <output aria-live="polite">
        {tool === 'distance'
          ? L('map:measurement.total', {
              value: distance(segments.reduce((a, b) => a + b, 0)),
            })
          : !valid
            ? L('map:measurement.simplePolygon')
            : L('map:measurement.surface', {
                value:
                  area >= 1000000
                    ? L('map:measurement.squareKilometers', {
                        value: (area / 1000000).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        }),
                      })
                    : L('map:measurement.squareMeters', {
                        value: area.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        }),
                      }),
              })}
      </output>
      {tool === 'distance' && segments.length > 0 && (
        <ol>
          {segments.map((value, index) => (
            <li key={index}>
              {L('map:measurement.segment', {
                index: index + 1,
                value: distance(value),
              })}
            </li>
          ))}
        </ol>
      )}
      <div className="map-measurement-actions">
        <Button size="sm" disabled={!points.length} onClick={undo}>
          {L('map:mapToolPanel.text.undo')}
        </Button>
        <Button size="sm" disabled={!points.length} onClick={clear}>
          {L('map:measurement.clear')}
        </Button>
        <Button size="sm" onClick={() => selectTool('pan')}>
          {L('common:action.close')}
        </Button>
      </div>
    </section>
  );
}
