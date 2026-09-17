import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { App } from '@/app/App';
import { localizationInstance } from '@/shared/i18n/config';
import {
  applyThemeToDocument,
  getInitialThemeMode,
  resolveTheme,
} from '@/shared/theme/theme';
import '@/app/styles/global.css';
import '@/app/styles/theme.css';
import '@/pages/landing/styles/landing.css';

applyThemeToDocument(resolveTheme(getInitialThemeMode()));

const root = document.querySelector<HTMLDivElement>('#root');

if (!root) {
  throw new Error('React root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={localizationInstance}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);
