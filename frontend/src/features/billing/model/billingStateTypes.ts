import type { BillingSummary, ConfirmPayment } from '@trasolve/shared';

export type BillingResult =
  | { kind: 'success' | 'cancelled' | 'cancelScheduled' | 'free' }
  | { kind: 'error'; message: string };
export type PaymentCelebration = {
  orderId: string;
  plan: BillingSummary['wallet']['plan'];
};
export type PaymentReturn = {
  success: boolean;
  input: ConfirmPayment;
  cleanUrl: string;
};
export type BillingOperation = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  finish: () => void;
};
export type BillingActivity = {
  busy: boolean;
  changingTokenMode: boolean;
  isBusy: () => boolean;
  begin: (kind: 'payment' | 'tokenMode') => BillingOperation | null;
};
export type BillingSnapshot = {
  summary: BillingSummary | null;
  publish: (summary: BillingSummary) => void;
  clearError: () => void;
  beginUpdate: () => {
    isCurrent: () => boolean;
    publish: (summary: BillingSummary) => void;
  };
  refresh: () => Promise<void>;
};
export type BillingWorkflow = {
  account: BillingSnapshot;
  activity: BillingActivity;
  report: (result: BillingResult) => void;
  onPaid: (payment: PaymentCelebration) => void;
  formatFailure: (cause: unknown) => string;
};
