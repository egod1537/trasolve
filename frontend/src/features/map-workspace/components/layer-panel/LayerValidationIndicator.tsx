import type { LayerValidationState } from '@/entities/trip';
import { useL } from '@/shared/i18n';

type Props = {
  validation?: LayerValidationState;
};

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 2.5 18 17H2L10 2.5Z" />
      <path d="M10 7v4.5M10 14.5v.1" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v5M10 14v.1" />
    </svg>
  );
}

export function LayerValidationIndicator({ validation }: Props) {
  const L = useL();
  const issues = validation?.issues.filter(
    (issue) => issue.level === 'error' || issue.level === 'warning',
  );
  if (!issues?.length) {
    return null;
  }

  const level = issues.some((issue) => issue.level === 'error')
    ? 'error'
    : 'warning';
  const levelLabel =
    level === 'error'
      ? L('map:layerValidationIndicator.text.error')
      : L('map:layerValidationIndicator.text.caution');
  const summary = `${levelLabel}: ${issues.map((issue) => issue.message).join(', ')}`;

  return (
    <span
      className={`trip-layer-validation is-${level}`}
      role="img"
      tabIndex={0}
      aria-label={summary}
      title={summary}
    >
      {level === 'error' ? <ErrorIcon /> : <WarningIcon />}
      <span className="trip-layer-validation-tooltip" role="tooltip">
        {issues.map((issue, index) => (
          <span key={`${issue.code ?? issue.message}-${index}`}>
            <strong>
              {issue.level === 'error'
                ? L('map:layerValidationIndicator.text.error')
                : L('map:layerValidationIndicator.text.caution')}
            </strong>
            {issue.message}
          </span>
        ))}
      </span>
    </span>
  );
}
