import { useBilling } from '../model/billingContext';
import { NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import './billing-checkout-dialog.css';

export function DebugTokenToggle({ compact = false }: { compact?: boolean }) {
  const L = useL();
  const billing = useBilling();
  if (billing.summary?.mode !== 'debug') {
    return null;
  }
  return (
    <Button
      className="debug-token-toggle"
      size="sm"
      role="switch"
      aria-checked={Boolean(billing.summary.unlimited)}
      title={L('auth:billing.debugNotice')}
      variant={billing.summary.unlimited ? 'primary' : 'secondary'}
      disabled={
        billing.busy || billing.loading || !billing.summary.unlimitedAvailable
      }
      loading={billing.changingTokenMode}
      onClick={() => void billing.toggleDebugUnlimited()}
    >
      {NL('∞')}
      {compact ? (
        <span className="sr-only">{L('auth:billing.debugMode')}</span>
      ) : (
        L('auth:billing.debugMode')
      )}
    </Button>
  );
}
