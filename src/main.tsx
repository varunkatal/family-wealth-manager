import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { SettingsProvider } from './app/SettingsContext';
import { StartGate } from './app/StartGate';
import { SyncProvider } from './app/SyncContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <SyncProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'}>
          <StartGate>
            <AppRoutes />
          </StartGate>
        </BrowserRouter>
      </SyncProvider>
    </SettingsProvider>
  </StrictMode>,
);
