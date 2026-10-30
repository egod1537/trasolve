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

export function GearIcon(props: Props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.55 1h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
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

export function ShuffleIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M4 7h2.4c4.8 0 5.2 10 10 10H20" />
      <path d="m17 14 3 3-3 3" />
      <path d="M4 17h2.4c1.7 0 2.8-1.3 3.8-3" />
      <path d="M13.8 10c.8-1.7 1.7-3 3.4-3H20" />
      <path d="m17 4 3 3-3 3" />
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
