import type { ReactNode, RefObject } from 'react';
import '@/features/map-workspace/styles/bottom-context-panel.css';
import { useL } from '@/shared/i18n';

import type { MapTool } from '../../measurement/measurementGeometry';
export type { MapTool } from '../../measurement/measurementGeometry';

type Props = {
  captureBusy: boolean;
  onCapture: () => void;
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
  className,
  label,
  disabled = false,
  pressed,
  expanded,
  controls,
  hasPopup,
  buttonRef,
  tutorialTarget,
  children,
  onClick,
}: {
  className?: string;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  hasPopup?: 'dialog';
  buttonRef?: RefObject<HTMLButtonElement | null>;
  tutorialTarget?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={className}
      ref={buttonRef}
      data-tutorial={tutorialTarget}
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
  captureBusy,
  onCapture,
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
  const L = useL();
  return (
    <div
      className="map-tool-panel"
      role="toolbar"
      aria-label={L('map:mapToolPanel.ariaLabel.mapTool')}
    >
      <ToolButton
        label={L('map:mapToolPanel.text.undo')}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <ToolIcon path="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12" />
      </ToolButton>
      <ToolButton
        label={L('map:mapToolPanel.text.runAgain')}
        disabled={!canRedo}
        onClick={onRedo}
      >
        <ToolIcon path="m15 4 5 5-5 5M20 9H10a6 6 0 0 0 0 12" />
      </ToolButton>
      <ToolButton
        label={L('map:mapToolPanel.text.moveMap')}
        pressed={activeTool === 'pan'}
        onClick={() => onSelectTool('pan')}
      >
        <ToolIcon path="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-7 6-2 0-4-1-5-3l-5-6a2 2 0 0 1 3-2l2 2Z" />
      </ToolButton>
      <ToolButton
        label={L('map:measurement.distance')}
        pressed={activeTool === 'distance'}
        onClick={() => onSelectTool('distance')}
      >
        <ToolIcon path="m3 16 13-13 5 5-13 13Zm3-3 3 3m0-6 3 3m0-6 3 3" />
      </ToolButton>
      <ToolButton
        label={L('map:measurement.area')}
        pressed={activeTool === 'area'}
        onClick={() => onSelectTool('area')}
      >
        <ToolIcon path="m4 6 13-3 4 13-12 5Zm0 0h.01M17 3h.01M21 16h.01M9 21h.01" />
      </ToolButton>
      <ToolButton
        className="map-tool-route-optimization"
        label={L('map:mapToolPanel.text.routeOptimization')}
        disabled={!onOpenRouteTools}
        expanded={routeToolsOpen}
        controls={routeToolsOpen ? routeToolsControlId : undefined}
        hasPopup="dialog"
        buttonRef={routeToolButtonRef}
        tutorialTarget="optimize"
        onClick={() => onOpenRouteTools?.()}
      >
        <ToolIcon path="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 16h3a3 3 0 0 0 3-3v-2a3 3 0 0 1 3-3h1" />
      </ToolButton>
      <ToolButton
        label={captureBusy ? L('map:capture.busy') : L('map:capture.download')}
        disabled={captureBusy}
        onClick={onCapture}
      >
        <ToolIcon path="M3 7h4l2-3h6l2 3h4v13H3Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      </ToolButton>
    </div>
  );
}
