import type { HTMLAttributes } from 'react';
import type { StatusTone } from '@/shared/ui/StatusBadge';
import '@/shared/ui/primitives.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: number;
  max?: number;
  tone?: StatusTone;
  animated?: boolean;
  label: string;
};

export function Progress({
  value,
  max = 100,
  tone = 'accent',
  animated = false,
  label,
  className = '',
  ...props
}: Props) {
  const normalizedMax = Math.max(1, max);
  const indeterminate = value === undefined;
  const normalizedValue = indeterminate
    ? undefined
    : Math.min(normalizedMax, Math.max(0, value));
  const percentage =
    normalizedValue === undefined
      ? undefined
      : (normalizedValue / normalizedMax) * 100;
  return (
    <div
      {...props}
      className={`ui-progress ui-progress--${tone}${animated ? ' is-animated' : ''}${indeterminate ? ' is-indeterminate' : ''} ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={normalizedMax}
      aria-valuenow={normalizedValue}
    >
      <span
        style={
          percentage === undefined ? undefined : { width: `${percentage}%` }
        }
      />
    </div>
  );
}
