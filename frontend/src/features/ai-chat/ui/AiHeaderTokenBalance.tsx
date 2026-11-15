import { TokenRemainingGauge } from '@/features/billing';
import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';

export function AiHeaderTokenBalance() {
  const mobile = useLayoutMaxWidth();
  return mobile ? (
    <div className="ai-header-token-balance">
      <TokenRemainingGauge />
    </div>
  ) : null;
}
