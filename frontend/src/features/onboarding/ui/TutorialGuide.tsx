import { useEffect, useId, useRef, useState } from 'react';
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
  const allowDestroy = useRef(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const exitTitleId = useId();

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
      onCloseClick: () => setConfirmExit(true),
      onDestroyStarted: (_element, _step, { driver: activeDriver }) => {
        if (disposed || allowDestroy.current) {
          activeDriver.destroy();
        } else {
          setConfirmExit(true);
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
        exit.addEventListener('click', () => {
          setConfirmExit(true);
        });
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
        allowDestroy.current = true;
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
      allowDestroy.current = true;
      stopTracking();
      observer.disconnect();
      instance.current = null;
      guide.destroy();
    };
  }, [L, tutorial.run]);

  useEffect(() => {
    const index = Math.max(
      0,
      TUTORIAL_STEPS.findIndex((step) => step === tutorial.progress.step),
    );
    const guide = instance.current;
    if (guide && guide.getActiveIndex() !== index) {
      guide.drive(index);
    }
  }, [tutorial.progress.step]);

  return confirmExit ? (
    <Dialog
      className="tutorial-exit-dialog"
      role="alertdialog"
      labelledBy={exitTitleId}
      onClose={() => setConfirmExit(false)}
    >
      <h2 id={exitTitleId}>{L('common:tutorial.action.skip')}</h2>
      <div className="tutorial-dialog-actions">
        <Button onClick={() => setConfirmExit(false)}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            current.current.stop();
            allowDestroy.current = true;
            setConfirmExit(false);
            instance.current?.destroy();
          }}
        >
          {L('common:tutorial.action.skip')}
        </Button>
      </div>
    </Dialog>
  ) : null;
}
