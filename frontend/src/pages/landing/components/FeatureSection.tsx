import { getLanguage, NL, useL } from '@/shared/i18n';
import {
  japanDotPath,
  tokyoPosition,
} from '@/pages/landing/visuals/cartography';

// Example itinerary data, not product UI labels or a saved user trip.
const examplePlaces = [
  {
    id: 'asakusa',
    names: { ko: '아사쿠사', ja: '浅草', en: 'Asakusa', mn: 'Асакуса' },
  },
  { id: 'ueno', names: { ko: '우에노', ja: '上野', en: 'Ueno', mn: 'Уэно' } },
  {
    id: 'akihabara',
    names: { ko: '아키하바라', ja: '秋葉原', en: 'Akihabara', mn: 'Акихабара' },
  },
];

export function FeatureSection() {
  const L = useL();
  const language = getLanguage();
  return (
    <section
      className="features"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="features-inner">
        <h2 id="features-title">{L('common:landing.example.heading')}</h2>
        <svg
          className="example-map"
          viewBox="0 0 400 280"
          aria-hidden="true"
          focusable="false"
        >
          <path className="example-map-land" d={japanDotPath} />
          <g transform={`translate(${tokyoPosition.x} ${tokyoPosition.y})`}>
            <circle className="example-map-halo" r="14" />
            <circle className="example-map-pin" r="5" />
            <text x="14" y="5">
              {NL('TOKYO')}
            </text>
          </g>
        </svg>
        <div className="example-itinerary">
          <h3>{L('common:landing.example.title')}</h3>
          <ol>
            {examplePlaces.map((place, index) => (
              <li key={place.id}>
                <span className="example-stop" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{place.names[language]}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
