import { useBilling } from '../model/billingContext';
import { TokenBalanceGauge } from './TokenBalanceGauge';
import './token-remaining-gauge.css';

export function TokenRemainingGauge() {
  const { summary } = useBilling();
  return (
    <div className="token-remaining-gauge">
      <TokenBalanceGauge
        remaining={summary?.wallet.remaining}
        provided={summary?.wallet.provided ?? 1}
      />
    </div>
  );
}
