import type { HTMLAttributes } from 'react';
import '@/shared/ui/primitives.css';

export type StatusTone =
  'neutral' | 'accent' | 'danger' | 'warning' | 'success';

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function StatusBadge({
  tone = 'neutral',
  className = '',
  ...props
}: Props) {
  return (
    <span
      {...props}
      className={`ui-status-badge ui-status-badge--${tone} ${className}`.trim()}
    />
  );
}
