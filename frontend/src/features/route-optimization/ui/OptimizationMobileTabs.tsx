import type { KeyboardEvent } from 'react';
import { useL } from '@/shared/i18n';

export type OptimizationMobileTab = 'settings' | 'validation';

export function OptimizationMobileTabs({
  id,
  selected,
  attention,
  onSelect,
}: {
  id: string;
  selected: OptimizationMobileTab;
  attention: boolean;
  onSelect: (tab: OptimizationMobileTab) => void;
}) {
  const L = useL();
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: OptimizationMobileTab;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        next = selected === 'settings' ? 'validation' : 'settings';
        break;
      case 'Home':
        next = 'settings';
        break;
      case 'End':
        next = 'validation';
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
      className="route-settings-mobile-tabs"
      role="tablist"
      aria-labelledby={id}
    >
      {(['settings', 'validation'] as const).map((tab) => (
        <button
          type="button"
          role="tab"
          key={tab}
          id={`${id}-tab-${tab}`}
          aria-controls={`${id}-panel-${tab}`}
          aria-selected={tab === selected}
          tabIndex={tab === selected ? 0 : -1}
          data-attention={tab === 'validation' && attention}
          onKeyDown={navigate}
          onClick={() => onSelect(tab)}
        >
          {tab === 'settings'
            ? L('routeOptimization:mobileTabs.settings')
            : L('routeOptimization:mobileTabs.validation')}
          {tab === 'validation' && attention && (
            <span className="route-settings-tab-dot" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}
