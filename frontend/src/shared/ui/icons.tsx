import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function CloseIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function ExpandIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" />
    </Icon>
  );
}

export function RefreshIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M20 11A8 8 0 1 0 18.5 16" />
      <path d="M20 5v6h-6" />
    </Icon>
  );
}

export function PlusIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function TrashIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v12.5A1.5 1.5 0 0 1 15.5 21h-7A1.5 1.5 0 0 1 7 19.5V7" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  );
}

export function BookIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M4 19V6.5A2.5 2.5 0 0 1 6.5 4H18a1 1 0 0 1 1 1v13" />
      <path d="M6.5 16H19v3.5a1.5 1.5 0 0 1-1.5 1.5h-11A2.5 2.5 0 0 1 4 18.5v0A2.5 2.5 0 0 1 6.5 16Z" />
    </Icon>
  );
}

export function LocationIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M20.5 10c0 6-8.5 11-8.5 11s-8.5-5-8.5-11a8.5 8.5 0 0 1 17 0Z" />
      <circle cx="12" cy="10" r="2.75" />
    </Icon>
  );
}
