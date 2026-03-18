import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { RunsPage } from './pages/RunsPage';
import { DiffPage } from './pages/DiffPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { HealthPage } from './pages/HealthPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';

const isLocalMode = __SENTINEL_MODE__ === 'local';

const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      {
        path: '/',
        element: <CommandCenterPage />,
        handle: { crumb: 'Command Center' },
      },
      {
        path: '/runs',
        element: <RunsPage />,
        handle: { crumb: 'Runs' },
      },
      {
        path: '/runs/:runId',
        element: <DiffPage />,
        handle: { crumb: 'Diff Review' },
      },
      ...(!isLocalMode ? [
        {
          path: '/settings',
          element: <SettingsPage />,
          handle: { crumb: 'Settings' },
        },
      ] : []),
      {
        path: '/projects/:projectId',
        handle: {
          crumb: 'project', // resolved to actual name by Breadcrumbs component
        },
        children: [
          {
            path: 'health',
            element: <HealthPage />,
            handle: { crumb: 'Health' },
          },
          {
            path: 'components',
            element: <ComponentsPage />,
            handle: { crumb: 'Components' },
          },
          ...(!isLocalMode ? [
            {
              path: 'schedules',
              element: <SchedulesPage />,
              handle: { crumb: 'Schedules' },
            },
            {
              path: 'environments',
              element: <EnvironmentsPage />,
              handle: { crumb: 'Environments' },
            },
          ] : []),
          {
            path: 'analytics',
            element: <AnalyticsPage />,
            handle: { crumb: 'Analytics' },
          },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
