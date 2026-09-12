import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Trip } from '../../domain/trip';
import { InlineRename } from './InlineRename';

type SaveStatus = 'ready' | 'saving' | 'error';

type Props = {
  trip: Trip;
  saveStatus: SaveStatus;
  savedAt: string;
  onAddLayer: () => void;
  onShareTrip?: () => void;
  onPreviewTrip?: () => void;
  onRenameTrip: (title: string) => void;
};

function formatSavedAt(value: string): { label: string; title: string } {
  const savedAt = new Date(value);
  if (Number.isNaN(savedAt.getTime())) {
    return { label: '저장됨', title: value };
  }

  const now = new Date();
  const sameDay =
    savedAt.getFullYear() === now.getFullYear() &&
    savedAt.getMonth() === now.getMonth() &&
    savedAt.getDate() === now.getDate();
  const time = `${String(savedAt.getHours()).padStart(2, '0')}:${String(
    savedAt.getMinutes(),
  ).padStart(2, '0')}`;
  const date = `${savedAt.getMonth() + 1}/${savedAt.getDate()}`;

  return {
    label: `마지막 저장 ${sameDay ? time : `${date} ${time}`}`,
    title: new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(savedAt),
  };
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export const LayerPanelHeader = memo(function LayerPanelHeader({
  trip,
  saveStatus,
  savedAt,
  onAddLayer,
  onShareTrip,
  onPreviewTrip,
  onRenameTrip,
}: Props) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewNoticeOpen, setPreviewNoticeOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const previewNoticeId = useId();
  const saved = formatSavedAt(savedAt);
  const placeCount = trip.days.reduce(
    (total, day) => total + day.places.length,
    0,
  );
  const saveLabel =
    saveStatus === 'saving'
      ? '저장 중…'
      : saveStatus === 'error'
        ? '저장 실패'
        : saved.label;

  useEffect(() => {
    if (!menuOpen && !previewNoticeOpen) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
        setPreviewNoticeOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuOpen(false);
      setPreviewNoticeOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen, previewNoticeOpen]);

  const commitTitle = (draft: string) => {
    const title = draft.trim();
    setTitleEditing(false);
    if (title && title !== trip.title) onRenameTrip(title);
  };
  const startTitleEditing = () => {
    setMenuOpen(false);
    setPreviewNoticeOpen(false);
    setTitleEditing(true);
  };
  const previewTrip = () => {
    setMenuOpen(false);
    if (onPreviewTrip) {
      setPreviewNoticeOpen(false);
      onPreviewTrip();
    } else {
      setPreviewNoticeOpen((open) => !open);
    }
  };

  return (
    <header ref={rootRef} className="trip-sidebar-header">
      <div className="trip-panel-header-body">
        <div className="trip-panel-header-copy">
          <h1 className="trip-plan-title">
            {titleEditing ? (
              <InlineRename
                value={trip.title}
                ariaLabel="여행 플랜 이름 수정"
                className="trip-plan-title-input"
                onCommit={commitTitle}
                onCancel={() => setTitleEditing(false)}
              />
            ) : (
              <span
                className="trip-plan-title-text"
                title="더블클릭하여 여행 이름 수정"
                onDoubleClick={startTitleEditing}
              >
                {trip.title}
              </span>
            )}
          </h1>
          <p className="trip-panel-header-meta">
            Day {trip.days.length}개 · 장소 {placeCount}개
          </p>
          <p
            className={`trip-last-saved is-${saveStatus}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            title={saveStatus === 'ready' ? saved.title : undefined}
          >
            {saveLabel}
          </p>
        </div>

        <div className="trip-panel-header-menu-anchor">
          <button
            type="button"
            className="trip-panel-header-menu-trigger"
            aria-label="여행 옵션"
            title="여행 옵션"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => {
              setPreviewNoticeOpen(false);
              setMenuOpen((open) => !open);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.25" />
              <circle cx="12" cy="12" r="1.25" />
              <circle cx="12" cy="19" r="1.25" />
            </svg>
          </button>
          {menuOpen && (
            <div id={menuId} className="trip-panel-header-menu" role="menu">
              <button type="button" role="menuitem" onClick={startTitleEditing}>
                여행 이름 변경
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="trip-panel-header-actions">
        <button
          type="button"
          className="trip-panel-header-action"
          aria-label="레이어 추가"
          onClick={onAddLayer}
        >
          <ActionIcon>
            <path d="M12 5v14M5 12h14" />
          </ActionIcon>
          <span>레이어 추가</span>
        </button>
        <button
          type="button"
          className="trip-panel-header-action"
          aria-label="여행 공유"
          title={onShareTrip ? '여행 공유' : '공유 기능 준비 중'}
          disabled={!onShareTrip}
          onClick={onShareTrip}
        >
          <ActionIcon>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5" />
          </ActionIcon>
          <span>공유</span>
        </button>
        <span className="trip-panel-preview-anchor">
          <button
            type="button"
            className="trip-panel-header-action"
            aria-label="여행 미리보기"
            aria-expanded={previewNoticeOpen}
            aria-controls={
              previewNoticeOpen && !onPreviewTrip ? previewNoticeId : undefined
            }
            onClick={previewTrip}
          >
            <ActionIcon>
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.75" />
            </ActionIcon>
            <span>미리보기</span>
          </button>
          {previewNoticeOpen && !onPreviewTrip && (
            <span
              id={previewNoticeId}
              className="trip-panel-preview-notice"
              role="status"
            >
              미리보기 기능을 준비하고 있습니다.
            </span>
          )}
        </span>
      </div>
    </header>
  );
});
