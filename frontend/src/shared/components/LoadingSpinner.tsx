import '../styles/loading-spinner.css';

type Props = {
  size?: 'sm' | 'md';
};

export function LoadingSpinner({ size = 'sm' }: Props) {
  return (
    <span
      className={`loading-spinner is-${size}`}
      aria-hidden="true"
    />
  );
}
