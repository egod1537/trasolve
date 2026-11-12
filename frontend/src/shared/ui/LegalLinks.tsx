import { LEGAL_PATHS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { withMobileLayout } from '@/shared/config/mobileLayout';

export function LegalLinks({
  newTab = false,
  className = '',
}: {
  newTab?: boolean;
  className?: string;
}) {
  const L = useL();
  const target = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <nav
      className={`legal-links ${className}`}
      aria-label={L('legal:documents')}
    >
      <a href={withMobileLayout(LEGAL_PATHS.terms)} {...target}>
        {L('legal:termsTitle')}
      </a>
      <a href={withMobileLayout(LEGAL_PATHS.privacy)} {...target}>
        {L('legal:privacyTitle')}
      </a>
    </nav>
  );
}
