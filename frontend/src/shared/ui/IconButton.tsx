import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from '@/shared/ui/Button';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  'aria-label': string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  function IconButton(
    { icon, className = '', children, ...props }: Props,
    ref,
  ) {
    return (
      <Button
        {...props}
        ref={ref}
        className={`ui-icon-button ${className}`.trim()}
      >
        {props.loading ? null : icon}
        {children}
      </Button>
    );
  },
);
