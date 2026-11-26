import { useL } from '@/shared/i18n';

type Props = {
  displayName: string;
  pictureUrl?: string;
  demo?: boolean;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function ProfileAvatar({
  displayName,
  pictureUrl,
  demo = false,
  imageClassName,
  fallbackClassName,
}: Props) {
  const L = useL();

  if (demo) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        {L('auth:mapUserControls.text.demoProfile')}
      </span>
    );
  }

  if (pictureUrl) {
    return (
      <img
        className={imageClassName}
        src={pictureUrl}
        alt=""
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span className={fallbackClassName} aria-hidden="true">
      {displayName.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}
