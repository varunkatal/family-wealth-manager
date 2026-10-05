import { Fragment, type ReactNode } from 'react';
import { SyncDecisionDialog } from '../features/sync/SyncDecisionDialog';
import { StartPage } from '../pages/StartPage';
import { useSync } from './SyncContext';

/** Shows the start screen until a storage mode is chosen; afterwards the app. */
export function StartGate({ children }: { children: ReactNode }) {
  const { mode, dataVersion } = useSync();
  return (
    <>
      {/* Remount pages when the sheet's data replaced this browser's, so they show it. */}
      {mode === null ? <StartPage /> : <Fragment key={dataVersion}>{children}</Fragment>}
      <SyncDecisionDialog />
    </>
  );
}
