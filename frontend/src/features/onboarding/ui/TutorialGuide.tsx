import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import {
  TUTORIAL_STEPS,
  type TutorialProgress,
  type TutorialStep,
} from '@trasolve/shared';
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
      onHighlighted: (_element, _step, { index }) => {
        if (!disposed && index !== undefined) {
          const highlightedStep = TUTORIAL_STEPS[index];
          if (highlightedStep) {
            current.current.step(highlightedStep);
          }
        }
      },
      onNextClick: () => {
        // Creation and Day addition advance only through their success callbacks.
        const activeStep = getActiveTutorialStep(guide);
        if (activeStep !== 'create' && activeStep !== 'days') {
          guide.moveNext();
        }
      },
      onPrevClick: () => {
        if (getActiveTutorialStep(guide) === 'add-place') {
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
    // Place details and the optimization dialog mount asynchronously. Move the
    // spotlight to the real action as soon as it becomes available.
    let lastTarget = guide.getActiveElement();
    const observer = new MutationObserver(() => {
      if (disposed || !guide.isActive()) {
        return;
      }
      const dynamicTarget = getDynamicTutorialTarget(
        current.current.progress.step,
      );
      if (
        dynamicTarget &&
        guide.getActiveElement() !== dynamicTarget.element &&
        lastTarget !== dynamicTarget.element
      ) {
        lastTarget = dynamicTarget.element;
        guide.drive(dynamicTarget.index);
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

function getDynamicTutorialTarget(
  step: TutorialProgress['step'],
): { element: Element; index: number } | null {
  if (step === 'add-place') {
    const element =
      document.querySelector('[data-tutorial="add-place"]') ??
      document.querySelector('[data-tutorial="place-search"]');
    return element ? { element, index: tutorialStepIndex('add-place') } : null;
  }
  if (step === 'optimize') {
    const element =
      document.querySelector('[data-tutorial="optimize-run"]') ??
      document.querySelector('[data-tutorial="optimize"]');
    return element ? { element, index: tutorialStepIndex('optimize') } : null;
  }
  if (step === 'optimize-running') {
    const element = document.querySelector(
      '[data-tutorial="optimize-running"]',
    );
    return element
      ? { element, index: tutorialStepIndex('optimize-running') }
      : null;
  }
  if (step === 'optimize-result') {
    const element =
      document.querySelector(
        '.route-apply-confirmation [data-tutorial="optimize-result"]',
      ) ?? document.querySelector('[data-tutorial="optimize-result"]');
    return element
      ? { element, index: tutorialStepIndex('optimize-result') }
      : null;
  }
  return null;
}

function getActiveTutorialStep(guide: Driver): TutorialStep | undefined {
  const index = guide.getActiveIndex();
  return index === undefined ? undefined : TUTORIAL_STEPS[index];
}

function tutorialStepIndex(step: TutorialStep): number {
  return TUTORIAL_STEPS.indexOf(step);
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
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      className="tutorial-exit-dialog"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
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
        <div className="tutorial-exit-copy">
          <h2 id={titleId}>{L('common:tutorial.action.skip')}</h2>
          <p id={descriptionId}>{L('common:tutorial.exit.description')}</p>
        </div>
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
