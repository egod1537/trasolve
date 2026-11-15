import type { Driver, State } from 'driver.js';

/** Follow layout shifts as well as scroll/resize, without restarting the step. */
export function trackTutorialLayout(guide: Driver): () => void {
  let previousElement: Element | undefined;
  let previousPopover: HTMLElement | undefined;
  let previousBounds: number[] = [];
  let frame: number;

  const update = () => {
    frame = window.requestAnimationFrame(update);
    const state = guide.getState() as State;
    const element = guide.getActiveElement();
    const popover = state.popover?.wrapper;
    // Let Driver finish its own step transition before refreshing its geometry.
    if (
      !guide.isActive() ||
      state.__transitionCallback ||
      !element?.isConnected ||
      !popover?.isConnected ||
      !popover.getClientRects().length
    ) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const bounds = [
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      popover.offsetWidth,
      popover.offsetHeight,
      window.innerWidth,
      window.innerHeight,
    ];
    if (
      element !== previousElement ||
      popover !== previousPopover ||
      bounds.some((value, index) => value !== previousBounds[index])
    ) {
      previousElement = element;
      previousPopover = popover;
      previousBounds = bounds;
      // Refresh spotlight, popover and arrow together. This does not advance
      // progress or steal focus when asynchronously loaded trip cards move UI.
      guide.refresh();
    }
  };

  frame = window.requestAnimationFrame(update);
  return () => window.cancelAnimationFrame(frame);
}
