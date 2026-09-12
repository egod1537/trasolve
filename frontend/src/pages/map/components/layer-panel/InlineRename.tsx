import { useLayoutEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  ariaLabel: string;
  className?: string;
  maxLength?: number;
  disabled?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

export function InlineRename({
  value,
  ariaLabel,
  className,
  maxLength = 200,
  disabled = false,
  onCommit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    if (save) {
      onCommit(draft);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className={className}
      type="text"
      maxLength={maxLength}
      value={draft}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
    />
  );
}
