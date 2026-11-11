import type { DriveStep } from 'driver.js';
import type { Localize } from '@/shared/i18n';

export function tutorialSteps(L: Localize): DriveStep[] {
  const side = window.matchMedia('(max-width: 700px)').matches
    ? 'bottom'
    : 'right';
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
        showButtons: ['previous', 'close'],
      },
    },
    {
      element: '[data-tutorial="optimize"]',
      popover: {
        side,
        title: L('common:tutorial.optimize.title'),
        description: L('common:tutorial.optimize.description'),
        showButtons: ['next', 'close'],
      },
    },
    {
      element: '[data-tutorial="ai"]',
      disableActiveInteraction: false,
      popover: {
        side,
        title: L('common:tutorial.ai.title'),
        description: L('common:tutorial.ai.description'),
      },
    },
  ];
}
