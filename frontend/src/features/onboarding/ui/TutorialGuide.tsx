import { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import { TUTORIAL_STEPS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { useTutorial } from '../model/tutorialContext';
import { tutorialSteps } from './tutorialSteps';
import { trackTutorialLayout } from './trackTutorialLayout';
import 'driver.js/dist/driver.css';
import './tutorial.css';

export function TutorialGuide() {
  const L = useL();
  const tutorial = useTutorial()!;
  const current = useRef(tutorial);
  useEffect(() => {
    current.current = tutorial;
  }, [tutorial]);
  const instance = useRef<Driver | null>(null);

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
      closeBtnLabel: L('common:tutorial.action.skip'),
      allowClose: true,
      overlayClickBehavior: 'none',
      disableActiveInteraction: true,
      waitForElement: 8000,
      onElementMissing: () => false,
      onHighlighted: (_element, _step, { index }) => {
        if (!disposed && index !== undefined) {
          current.current.step(index);
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
      onDestroyed: (_element, _step, { reason }) => {
        if (
          !disposed &&
          (reason === 'close' || reason === 'escape' || reason === 'overlay')
        ) {
          current.current.stop();
        }
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
      if (disposed || current.current.progress.step !== 'add-place') {
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

  return null;
}
