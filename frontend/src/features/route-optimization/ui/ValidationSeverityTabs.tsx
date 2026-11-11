import type { KeyboardEvent } from 'react';
import { getLanguage, useL } from '@/shared/i18n';

export type ValidationSeverity = 'warning' | 'error';

export function ValidationSeverityTabs({
  id,
  selected,
  counts,
  onSelect,
}: {
  id: string;
  selected: ValidationSeverity;
  counts: Record<ValidationSeverity, number>;
  onSelect(severity: ValidationSeverity): void;
}) {
  const L = useL();
  const number = new Intl.NumberFormat(getLanguage());
  const changeWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: ValidationSeverity;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        next = selected === 'warning' ? 'error' : 'warning';
        break;
      case 'Home':
        next = 'warning';
        break;
      case 'End':
        next = 'error';
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return (
    <div
      className="route-settings-validation-tabs"
      role="tablist"
      aria-labelledby={`${id}-title`}
    >
      {(['warning', 'error'] as const).map((severity) => (
        <button
          key={severity}
          type="button"
          role="tab"
          id={`${id}-tab-${severity}`}
          data-severity={severity}
          aria-selected={selected === severity}
          aria-controls={id}
          tabIndex={selected === severity ? 0 : -1}
          onKeyDown={changeWithKeyboard}
          onClick={() => onSelect(severity)}
        >
          {severity === 'warning'
            ? L('map:layerValidationIndicator.text.caution')
            : L('map:layerValidationIndicator.text.error')}
          <span>{number.format(counts[severity])}</span>
        </button>
      ))}
    </div>
  );
}
