import { lazy, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { Layout } from './Layout';

// The dashboard loads with the app; other pages load when first opened, keeping the first load small.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const FamilyPage = page(() => import('../pages/FamilyPage'), 'FamilyPage');
const MemberDetailPage = page(() => import('../pages/MemberDetailPage'), 'MemberDetailPage');
const AssetsPage = page(() => import('../pages/AssetsPage'), 'AssetsPage');
const LiabilitiesPage = page(() => import('../pages/LiabilitiesPage'), 'LiabilitiesPage');
const ContributionsPage = page(() => import('../pages/ContributionsPage'), 'ContributionsPage');
const CashFlowPage = page(() => import('../pages/CashFlowPage'), 'CashFlowPage');
const GoalsPage = page(() => import('../pages/GoalsPage'), 'GoalsPage');
const ProjectionsPage = page(() => import('../pages/ProjectionsPage'), 'ProjectionsPage');
const HistoryPage = page(() => import('../pages/HistoryPage'), 'HistoryPage');
const DataPage = page(() => import('../pages/DataPage'), 'DataPage');
const SettingsPage = page(() => import('../pages/SettingsPage'), 'SettingsPage');

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="family/:memberId" element={<MemberDetailPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="liabilities" element={<LiabilitiesPage />} />
        <Route path="investments" element={<ContributionsPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="projections" element={<ProjectionsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
