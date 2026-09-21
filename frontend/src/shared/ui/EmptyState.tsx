import type { HTMLAttributes, ReactNode } from 'react';
import '@/shared/ui/primitives.css';

type Props = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
  ...props
}: Props) {
  return (
    <div {...props} className={`ui-empty-state ${className}`.trim()}>
      {icon && <span className="ui-empty-state__icon">{icon}</span>}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
