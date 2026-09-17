import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/shared/theme/useTheme';
import type { ThemeMode } from '@/shared/theme/theme';

const themeOptions: readonly {
  mode: ThemeMode;
  label: string;
  icon: ReactNode;
}[] = [
  { mode: 'system', label: '시스템', icon: <DesktopIcon /> },
  { mode: 'light', label: '라이트', icon: <SunIcon /> },
  { mode: 'dark', label: '다크', icon: <MoonIcon /> },
];

export function ThemeControl({ className = '' }: { className?: string }) {
  const { themeMode, setThemeMode } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected =
    themeOptions.find((option) => option.mode === themeMode) ?? themeOptions[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`theme-control ${className}`.trim()}>
      <button
        type="button"
        className="theme-control-trigger"
        aria-label={`테마: ${selected.label}`}
        title={`테마: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {selected.icon}
      </button>
      {open && (
        <div id={menuId} className="theme-control-menu" role="menu">
          {themeOptions.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="menuitemradio"
              aria-checked={themeMode === option.mode}
              onClick={() => {
                setThemeMode(option.mode);
                setOpen(false);
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              <CheckIcon visible={themeMode === option.mode} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
      <path d="M8.5 20h7M12 16.5V20" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    </svg>
  );
}

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      className="theme-control-check"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-visible={visible}
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
