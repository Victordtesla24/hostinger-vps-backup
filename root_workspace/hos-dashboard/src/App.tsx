import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { useHOSStore } from './store/hosStore';
import { initWS } from './store/wsClient';
import { WorkRequestsPage } from './pages/WorkRequestsPage';
import { AgentsPage } from './pages/AgentsPage';
import { QualityGatesPage } from './pages/QualityGatesPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { DashboardPage } from './pages/DashboardPage';
import { CronJobsPage } from './pages/CronJobsPage';

export default function App() {
  const currentPage = useHOSStore((s) => s.currentPage);

  useEffect(() => {
    initWS();
  }, []);

  return (
    <Layout>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'work-requests' && <WorkRequestsPage />}
      {currentPage === 'agents' && <AgentsPage />}
      {currentPage === 'quality-gates' && <QualityGatesPage />}
      {currentPage === 'telemetry' && <TelemetryPage />}
      {currentPage === 'cron-jobs' && <CronJobsPage />}
    </Layout>
  );
}
