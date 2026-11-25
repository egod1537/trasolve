import { NL } from '@/shared/i18n';
import './demo-badge.css';

export function DemoBadge() {
  return <span className="demo-mode-badge">{NL('DEMO')}</span>;
}
