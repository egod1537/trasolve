import { matchesLayoutMaxWidth } from '@/shared/config/mobileLayout';
import type { DriveStep } from 'driver.js';
import type { Localize } from '@/shared/i18n';

type TutorialSide = 'bottom' | 'right';

export function tutorialSteps(L: Localize): DriveStep[] {
  const side = matchesLayoutMaxWidth(700) ? 'bottom' : 'right';
  return [
    ...tripSetupSteps(L, side),
    ...optimizationSteps(L, side),
    aiStep(L, side),
  ];
}

function tripSetupSteps(L: Localize, side: TutorialSide): DriveStep[] {
  return [
    {
      element: '[data-tutorial="create-trip"]',
      disableActiveInteraction: false,
      popover: {
        side,
        title: L('common:tutorial.create.title'),
        description: L('common:tutorial.create.description'),
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tutorial="add-day"]',
      disableActiveInteraction: false,
      popover: {
        side,
        title: L('common:tutorial.days.title'),
        description: L('common:tutorial.days.description'),
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tutorial="place-search"]',
      disableActiveInteraction: false,
      allowedElements: ['.map-place-search-results'],
      popover: {
        side: 'bottom',
        title: L('common:tutorial.search.title'),
        description: L('common:tutorial.search.description'),
        showButtons: ['next', 'close'],
      },
    },
    {
      element: () =>
        document.querySelector<HTMLElement>('[data-tutorial="add-place"]') ??
        document.querySelector<HTMLElement>('[data-tutorial="place-search"]')!,
      disableActiveInteraction: false,
      allowedElements: ['.map-place-search-results'],
      popover: {
        side,
        title: L('common:tutorial.addPlace.title'),
        description: L('common:tutorial.addPlace.description'),
        showButtons: ['previous', 'next', 'close'],
      },
    },
  ];
}

function optimizationSteps(L: Localize, side: TutorialSide): DriveStep[] {
  return [
    {
      element: () =>
        document.querySelector<HTMLElement>('[data-tutorial="optimize-run"]') ??
        document.querySelector<HTMLElement>('[data-tutorial="optimize"]')!,
      disableActiveInteraction: false,
      allowedElements: ['.route-settings-dialog'],
      popover: {
        side,
        title: L('common:tutorial.optimize.title'),
        description: L('common:tutorial.optimize.description'),
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tutorial="optimize-running"]',
      disableActiveInteraction: false,
      allowedElements: ['.route-review-controls'],
      popover: {
        side,
        title: L(
          'routeOptimization:routeOptimizationProgressDialog.getTitle.text.optimizingRoute',
        ),
        description: L(
          'routeOptimization:routeOptimizationModal.text.awaitingOptimizationResults',
        ),
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tutorial="optimize-result"]',
      disableActiveInteraction: false,
      allowedElements: ['.route-apply-confirmation'],
      popover: {
        side,
        title: L(
          'routeOptimization:routeOptimizationModal.action.applyThisResult',
        ),
        description: L(
          'routeOptimization:routeOptimizationModal.description.compareCurrentRouteOptimizedRouteBy',
        ),
        showButtons: ['close'],
      },
    },
  ];
}

function aiStep(L: Localize, side: TutorialSide): DriveStep {
  return {
    element: '[data-tutorial="ai"]',
    disableActiveInteraction: false,
    popover: {
      side,
      title: L('common:tutorial.ai.title'),
      description: L('common:tutorial.ai.description'),
      showButtons: ['next'],
    },
  };
}
