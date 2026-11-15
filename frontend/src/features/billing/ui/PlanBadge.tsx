import type { TokenWallet } from '@trasolve/shared';
import { NL } from '@/shared/i18n';
import './paid-token-balance.css';

export function PlanBadge({
  plan,
  showFree = false,
}: {
  plan: TokenWallet['plan'];
  showFree?: boolean;
}) {
  if (plan === 'free') {
    return showFree ? (
      <span className="paid-plan-badge" data-plan="free">
        {NL('Free')}
      </span>
    ) : null;
  }
  return (
    <span className="paid-plan-badge" data-plan={plan}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={
            plan === 'plus'
              ? 'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z'
              : 'm3 6 5 5 4-8 4 8 5-5-2 13H5Zm2 15h14v-1H5Z'
          }
        />
      </svg>
      {plan === 'plus' ? NL('Plus') : NL('Pro')}
    </span>
  );
}
