import { cloneElement, useId, type ReactElement } from 'react';
import '@/shared/ui/primitives.css';

type TooltipChildProps = {
  'aria-describedby'?: string;
};

type Props = {
  label: string;
  children: ReactElement<TooltipChildProps>;
};

export function Tooltip({ label, children }: Props) {
  const id = useId();
  const describedBy = [children.props['aria-describedby'], id]
    .filter(Boolean)
    .join(' ');

  return (
    <span className="ui-tooltip">
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span id={id} className="ui-tooltip__content" role="tooltip">
        {label}
      </span>
    </span>
  );
}
