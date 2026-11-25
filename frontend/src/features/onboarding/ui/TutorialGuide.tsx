import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import { TUTORIAL_STEPS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { useTutorial } from '../model/tutorialContext';
import { tutorialSteps } from './tutorialSteps';
import { trackTutorialLayout } from './trackTutorialLayout';
import 'driver.js/dist/driver.css';
import './tutorial.css';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';

export function TutorialGuide() {
  const L = useL();
  const tutorial = useTutorial()!;
  const current = useRef(tutorial);
  useEffect(() => {
    current.current = tutorial;
  }, [tutorial]);
  const instance = useRef<Driver | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const requestExit = useCallback((guide: Driver | null = instance.current) => {
    setConfirmExit(true);
    guide?.destroy();
  }, []);

  useEffect(() => {
    let disposed = false;
    const guide = driver({
      steps: tutorialSteps(L),
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      smoothScroll: false,
      overlayOpacity: 0.65,
      stagePadding: 7,
      stageRadius: 12,
      popoverClass: 'trasolve-tutorial',
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: L('admin:common.action.next'),
      prevBtnText: L('admin:common.action.previous'),
      doneBtnText: L('common:tutorial.action.finish'),
      closeBtnLabel: L('common:action.close'),
      allowClose: true,
      overlayClickBehavior: 'none',
      disableActiveInteraction: true,
      waitForElement: 8000,
      onElementMissing: () => false,
      onCloseClick: () => requestExit(),
      onDestroyStarted: (_element, _step, { driver: activeDriver }) => {
        if (disposed) {
          activeDriver.destroy();
        } else {
          requestExit(activeDriver);
        }
      },
      onPopoverRender: (popover, { index }) => {
        popover.wrapper.querySelector('.tutorial-exit-button')?.remove();
        if (index === TUTORIAL_STEPS.length - 1) {
          return;
        }
        const exit = document.createElement('button');
        exit.type = 'button';
        exit.className = 'driver-popover-footer-btn tutorial-exit-button';
        exit.textContent = L('common:tutorial.action.skip');
        exit.addEventListener('click', () => requestExit());
        popover.footer.append(exit);
      },
      onHighlighted: (element, _step, { index }) => {
        if (!disposed && index !== undefined) {
          current.current.step(index);
          if (index === 4) {
            element?.addEventListener(
              'click',
              () => current.current.suspendOverlay(),
              { once: true },
            );
          }
        }
      },
      onNextClick: () => {
        // Creation advances only through the repository's success callback.
        if (![0, 1, 3].includes(guide.getActiveIndex() ?? 0)) {
          guide.moveNext();
        }
      },
      onPrevClick: () => {
        if ([3, 5].includes(guide.getActiveIndex() ?? 0)) {
          guide.movePrevious();
        }
      },
      onDoneClick: () => {
        current.current.stop(true);
        guide.destroy();
      },
    });
    instance.current = guide;
    guide.drive(
      Math.max(
        0,
        TUTORIAL_STEPS.findIndex(
          (step) => step === current.current.progress.step,
        ),
      ),
    );
    // Place details arrive asynchronously; move the spotlight to the real Add
    // button as soon as it is mounted, and retain search/retry while loading.
    let lastTarget = guide.getActiveElement();
    const observer = new MutationObserver(() => {
      if (
        disposed ||
        !guide.isActive() ||
        current.current.progress.step !== 'add-place'
      ) {
        return;
      }
      const target =
        document.querySelector('[data-tutorial="add-place"]') ??
        document.querySelector('[data-tutorial="place-search"]');
      if (
        target &&
        guide.getActiveElement() !== target &&
        lastTarget !== target
      ) {
        lastTarget = target;
        guide.drive(3);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const stopTracking = trackTutorialLayout(guide);
    return () => {
      disposed = true;
      stopTracking();
      observer.disconnect();
      instance.current = null;
      guide.destroy();
    };
  }, [L, requestExit, tutorial.run]);

  useEffect(() => {
    const index = Math.max(
      0,
      TUTORIAL_STEPS.findIndex((step) => step === tutorial.progress.step),
    );
    const guide = instance.current;
    if (!confirmExit && guide && guide.getActiveIndex() !== index) {
      guide.drive(index);
    }
  }, [confirmExit, tutorial.progress.step]);

  return confirmExit ? (
    <TutorialExitDialog
      onCancel={() => setConfirmExit(false)}
      onConfirm={() => {
        current.current.stop();
        setConfirmExit(false);
      }}
    />
  ) : null;
}

function TutorialExitDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const L = useL();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      className="tutorial-exit-dialog"
      role="alertdialog"
      labelledBy={titleId}
      initialFocusRef={cancelRef}
      onClose={onCancel}
    >
      <div className="tutorial-exit-heading">
        <span className="tutorial-exit-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 8v5" />
            <path d="M12 16.5v.01" />
            <path d="M10.3 3.8 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <h2 id={titleId}>{L('common:tutorial.action.skip')}</h2>
      </div>
      <div className="tutorial-dialog-actions">
        <Button ref={cancelRef} onClick={onCancel}>
          {L('common:action.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {L('common:tutorial.action.skip')}
        </Button>
      </div>
    </Dialog>
  );
}
