import type { ReactNode, RefObject } from 'react';
import '../../styles/bottom-context-panel.css';

export type MapTool = 'pan';

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  activeTool: MapTool;
  onUndo: () => void;
  onRedo: () => void;
  onSelectTool: (tool: MapTool) => void;
  onOpenRouteTools?: () => void;
  routeToolsOpen?: boolean;
  routeToolsControlId?: string;
  routeToolButtonRef?: RefObject<HTMLButtonElement | null>;
};

function ToolIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function ToolButton({
  label,
  disabled = false,
  pressed,
  expanded,
  controls,
  hasPopup,
  buttonRef,
  children,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  hasPopup?: 'dialog';
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={hasPopup}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MapToolPanel({
  canUndo,
  canRedo,
  activeTool,
  onUndo,
  onRedo,
  onSelectTool,
  onOpenRouteTools,
  routeToolsOpen = false,
  routeToolsControlId,
  routeToolButtonRef,
}: Props) {
  return (
    <div className="map-tool-panel" role="toolbar" aria-label="지도 도구">
      <ToolButton label="실행 취소" disabled={!canUndo} onClick={onUndo}>
        <ToolIcon path="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12" />
      </ToolButton>
      <ToolButton label="다시 실행" disabled={!canRedo} onClick={onRedo}>
        <ToolIcon path="m15 4 5 5-5 5M20 9H10a6 6 0 0 0 0 12" />
      </ToolButton>
      <span className="map-tool-panel-separator" aria-hidden="true" />
      <ToolButton
        label="지도 이동"
        pressed={activeTool === 'pan'}
        onClick={() => onSelectTool('pan')}
      >
        <ToolIcon path="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-7 6-2 0-4-1-5-3l-5-6a2 2 0 0 1 3-2l2 2Z" />
      </ToolButton>
      <span className="map-tool-panel-separator" aria-hidden="true" />
      <ToolButton
        label="경로 최적화"
        disabled={!onOpenRouteTools}
        expanded={routeToolsOpen}
        controls={routeToolsOpen ? routeToolsControlId : undefined}
        hasPopup="dialog"
        buttonRef={routeToolButtonRef}
        onClick={() => onOpenRouteTools?.()}
      >
        <ToolIcon path="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 16h3a3 3 0 0 0 3-3v-2a3 3 0 0 1 3-3h1" />
      </ToolButton>
    </div>
  );
}
