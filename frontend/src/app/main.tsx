import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { App } from './App';
import { localizationInstance } from '../shared/i18n/config';
import '../shared/styles/global.css';
import '../pages/landing/styles/landing.css';

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
