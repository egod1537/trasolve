import { useId, useRef } from 'react';
import { useBilling } from '../model/billingContext';
import { getLanguage, NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import './billing-checkout-dialog.css';

export function CheckoutConfirmationDialog() {
  const L = useL();
  const billing = useBilling();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const checkout = billing.pendingCheckout;
  if (!checkout) {
    return null;
  }
  const product = checkout.product;
  const number = new Intl.NumberFormat(getLanguage());
  const money = new Intl.NumberFormat(getLanguage(), {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  });
  const name =
    product.id === 'plus'
      ? NL('Plus')
      : product.id === 'pro'
        ? NL('Pro')
        : L('auth:billing.tokenPack', {
            tokens: number.format(product.tokens),
          });
  const cancel = () => {
    if (!billing.busy) {
      void billing.finishCheckout('cancel');
    }
  };
  return (
    <Dialog
      className="billing-checkout-dialog"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={cancelRef}
      busy={billing.busy}
      closeOnBackdrop={!billing.busy}
      closeOnEscape={!billing.busy}
      onClose={cancel}
    >
      <h2 id={titleId}>{name}</h2>
      <p id={descriptionId} className="billing-checkout-amount">
        {L('auth:billing.debugAmount', {
          amount: money.format(product.amount),
          tokens: number.format(product.tokens),
        })}
      </p>
      {product.kind === 'subscription' && (
        <p className="billing-checkout-terms">
          {L('auth:billing.subscriptionTerms')}
        </p>
      )}
      {checkout.upgrade && (
        <div className="billing-checkout-terms">
          <p>
            {L('auth:billing.renewsAt', {
              date: new Intl.DateTimeFormat(getLanguage()).format(
                new Date(checkout.upgrade.renewsAt),
              ),
            })}
          </p>
          <p>
            <strong>{money.format(checkout.upgrade.nextProduct.amount)}</strong>{' '}
            {L('auth:tokenPlans.perMonth')}
          </p>
        </div>
      )}
      {checkout.mode === 'debug' && (
        <p className="billing-checkout-terms">
          {L('auth:billing.debugNotice')}
        </p>
      )}
      <div className="billing-checkout-actions">
        <Button ref={cancelRef} disabled={billing.busy} onClick={cancel}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={billing.busy}
          onClick={() => void billing.finishCheckout('success')}
        >
          {L('admin:common.action.confirm')}
        </Button>
      </div>
      {checkout.mode === 'debug' && (
        <details className="billing-checkout-tools">
          <summary>{L('auth:billing.debugMode')}</summary>
          <Button
            size="sm"
            variant="danger"
            disabled={billing.busy}
            onClick={() => void billing.finishCheckout('failure')}
          >
            {L('auth:billing.simulateFailure')}
          </Button>
        </details>
      )}
    </Dialog>
  );
}
