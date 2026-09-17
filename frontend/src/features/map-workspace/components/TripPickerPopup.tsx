import { useId } from 'react';
import type { Trip } from '@trasolve/shared';
import { ThemeControl } from '@/shared/theme/ThemeControl';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { IconButton } from '@/shared/ui/IconButton';
import {
  BookIcon,
  CloseIcon,
  LocationIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

type Props = {
  trips: readonly Trip[];
  busy: boolean;
  error: string | null;
  canClose: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onCreateExample: () => void;
  onDelete: (id: string) => void;
};

export function TripPickerPopup({
  trips,
  busy,
  error,
  canClose,
  onClose,
  onRefresh,
  onOpen,
  onCreate,
  onCreateExample,
  onDelete,
}: Props) {
  const titleId = useId();

  return (
    <Dialog
      className="trip-map-picker-popup"
      backdropClassName="trip-map-picker-backdrop"
      labelledBy={titleId}
      closeOnBackdrop={false}
      closeOnEscape={canClose}
      onClose={onClose}
    >
      <header className="trip-map-picker-header">
        <h2 id={titleId}>내 여행</h2>
        <div className="trip-map-picker-header-actions">
          <ThemeControl />
          <IconButton
            className="trip-map-picker-close"
            aria-label="여행 선택 닫기"
            title="닫기"
            variant="ghost"
            size="sm"
            icon={<CloseIcon />}
            disabled={!canClose}
            onClick={onClose}
          />
        </div>
      </header>

      <div className="trip-map-picker-actions">
        <Button
          className="trip-map-picker-action is-primary"
          variant="primary"
          disabled={busy}
          startIcon={<PlusIcon />}
          onClick={onCreate}
        >
          <span>새 여행 만들기</span>
        </Button>
        <Button
          className="trip-map-picker-action"
          disabled={busy}
          startIcon={<BookIcon />}
          onClick={onCreateExample}
        >
          <span>도쿄 예시 여행 만들기</span>
        </Button>
        <IconButton
          className="trip-map-picker-action trip-map-picker-refresh"
          aria-label="새로고침"
          title="새로고침"
          variant="secondary"
          size="sm"
          icon={<RefreshIcon />}
          loading={busy}
          disabled={busy}
          onClick={onRefresh}
        />
      </div>

      {busy && (
        <p className="trip-map-picker-status" role="status">
          <LoadingSpinner />
          여행을 불러오고 있습니다.
        </p>
      )}
      {error && (
        <p className="trip-map-picker-status is-error" role="alert">
          {error}
        </p>
      )}
      {!busy && !error && !trips.length && (
        <EmptyState
          className="trip-map-picker-empty"
          title="저장된 여행이 없습니다."
          description="첫 여행을 만들어 보세요."
        />
      )}

      {!!trips.length && (
        <ul className="trip-map-picker-list">
          {trips.map((trip) => (
            <li key={trip.id} className="trip-map-picker-item">
              <div className="trip-map-picker-item-icon" aria-hidden="true">
                <LocationIcon />
              </div>
              <div className="trip-map-picker-item-body">
                <strong className="trip-map-picker-item-title">
                  {trip.title}
                </strong>
                <span className="trip-map-picker-item-meta">
                  Day {trip.days.length}개 ·{' '}
                  {trip.days.reduce(
                    (count, day) => count + day.places.length,
                    0,
                  )}
                  개 장소
                </span>
              </div>
              <div className="trip-map-picker-item-actions">
                <Button
                  className="trip-map-picker-item-open"
                  size="sm"
                  disabled={busy}
                  onClick={() => onOpen(trip.id)}
                >
                  열기
                </Button>
                <IconButton
                  className="trip-map-picker-item-delete"
                  aria-label={`${trip.title} 삭제`}
                  title="삭제"
                  variant="ghost"
                  size="sm"
                  icon={<TrashIcon />}
                  disabled={busy}
                  onClick={() => onDelete(trip.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
