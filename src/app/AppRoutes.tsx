import { Route, Routes } from 'react-router-dom';
import { AssetsPage } from '../pages/AssetsPage';
import { CashFlowPage } from '../pages/CashFlowPage';
import { ContributionsPage } from '../pages/ContributionsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { FamilyPage } from '../pages/FamilyPage';
import { GoalsPage } from '../pages/GoalsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { LiabilitiesPage } from '../pages/LiabilitiesPage';
import { ProjectionsPage } from '../pages/ProjectionsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { Layout } from './Layout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="liabilities" element={<LiabilitiesPage />} />
        <Route path="investments" element={<ContributionsPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="projections" element={<ProjectionsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
