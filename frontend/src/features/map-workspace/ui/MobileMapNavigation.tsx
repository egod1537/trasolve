import { useL } from '@/shared/i18n';
import {
  useMobileNavigation,
  type MobileMapTab,
} from '../model/MobileNavigation';
import '../styles/mobile-navigation.css';

type Props = { onOpenTrips: () => void; onNavigate: () => void };

export function MobileMapNavigation({ onOpenTrips, onNavigate }: Props) {
  const L = useL();
  const navigation = useMobileNavigation();
  if (!navigation) {
    return null;
  }
  const items = [
    {
      tab: 'map',
      label: L('map:googleMap.ariaLabel.map'),
      path: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16',
    },
    {
      tab: 'layers',
      label: L(
        'routeOptimization:routeSchedulePreview.beforeSchedule.tooltip.schedule',
      ),
      path: 'm12 3 10 6-10 6L2 9Zm-10 10 10 6 10-6M2 17l10 6 10-6',
    },
    {
      tab: 'ai',
      label: L('ai:mapAiPanel.title.aiPlanner'),
      path: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    },
  ] satisfies { tab: MobileMapTab; label: string; path: string }[];
  return (
    <nav
      className="mobile-map-navigation"
      aria-label={L('common:header.ariaLabel.mainMenu')}
    >
      {items.map(({ tab, label, path }) => (
        <button
          key={tab}
          type="button"
          data-tutorial={tab === 'ai' ? 'ai' : undefined}
          aria-current={navigation.tab === tab ? 'page' : undefined}
          onClick={() => {
            onNavigate();
            navigation.navigate(tab);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={path} />
          </svg>
          <span>{label}</span>
        </button>
      ))}
      <button type="button" aria-haspopup="dialog" onClick={onOpenTrips}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h6l2 2h8v13H4ZM4 5V3h6l2 2" />
        </svg>
        <span>{L('trip:tripPickerPopup.title.myTrip')}</span>
      </button>
    </nav>
  );
}
