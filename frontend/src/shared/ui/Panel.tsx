import type { HTMLAttributes } from 'react';
import '@/shared/ui/primitives.css';

export function Panel({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`ui-panel ${className}`.trim()} />;
}
