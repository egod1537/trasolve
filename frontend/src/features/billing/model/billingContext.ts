import { createContext, useContext } from 'react';
import type {
  BillingSummary,
  PaymentCheckout,
  PaymentProductId,
} from '@trasolve/shared';

export type BillingContextValue = {
  summary: BillingSummary | null;
  loading: boolean;
  changingTokenMode: boolean;
  toggleDebugUnlimited: () => Promise<void>;
  busy: boolean;
  error: string | null;
  authenticated: boolean;
  pendingCheckout: PaymentCheckout | null;
  plansOpen: boolean;
  dialogId: string;
  openPlans: () => void;
  closePlans: () => void;
  refresh: () => Promise<void>;
  purchase: (product: PaymentProductId) => Promise<void>;
  finishCheckout: (outcome: 'success' | 'failure' | 'cancel') => Promise<void>;
  cancelSubscription: (immediate?: boolean) => Promise<void>;
  login: () => void;
};
export const BillingContext = createContext<BillingContextValue | null>(null);
export function useBilling(): BillingContextValue {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('Billing provider is missing.');
  }
  return context;
}
