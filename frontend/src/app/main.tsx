import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../shared/styles/global.css';
import '../pages/landing/styles/landing.css';

const root = document.querySelector<HTMLDivElement>('#root');

if (!root) {
  throw new Error('React root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
