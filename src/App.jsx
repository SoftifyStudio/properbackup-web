import React, { useEffect } from 'react';
import { I18nProvider } from './i18n/I18nContext.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { RecoveryProvider } from './recovery/RecoveryContext.jsx';
import AuthLanding from './auth/AuthLanding.jsx';
import ServersPage from './servers/ServersPage.jsx';
import BackupsPage from './servers/BackupsPage.jsx';
import SubscriptionPage from './subscription/SubscriptionPage.jsx';
import AgentHealthDashboard from './monitoring/AgentHealthDashboard.jsx';
import StorageQuotaDashboard from './monitoring/StorageQuotaDashboard.jsx';
import PlanDisplay from './monitoring/PlanDisplay.jsx';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

function AgentQueryCleaner() {
  const { token } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get('agent') !== '1') return;
    ['agent', 'machineId', 'unlinked', 'serverId', 'needsLogin'].forEach(k => u.searchParams.delete(k));
    navigate(`${u.pathname}${u.search}`, { replace: true });
  }, [token, navigate]);
  return null;
}

function AppRoutesInner() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const serverId = params.serverId;
  const serverName = search.get('name') || serverId || '';

  if (!token) {
    return <AuthLanding />;
  }

  if (serverId) {
    return (
      <BackupsPage
        server={{ id: serverId, name: serverName }}
        onBack={() => navigate('/servers')}
      />
    );
  }

  return (
    <ServersPage
      onSelectServer={(server) => navigate(`/servers/${encodeURIComponent(server.id)}?name=${encodeURIComponent(server.name)}`)}
    />
  );
}

function SubscriptionPageWrapper() {
  const { token } = useAuth();
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  return <SubscriptionPage onBack={() => navigate('/servers')} />;
}

function DashboardPageWrapper({ Component }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-border bg-panel">
        <button className="btn-ghost text-xs py-1.5" onClick={() => navigate('/servers')}>← Back</button>
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6 w-full mx-auto max-w-6xl">
        <Component />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { token } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={token ? '/servers' : '/login'} replace />} />
        <Route path="/login" element={<AppRoutesInner />} />
        <Route path="/servers" element={<AppRoutesInner />} />
        <Route path="/servers/:serverId" element={<AppRoutesInner />} />
        <Route path="/account/subscription" element={<SubscriptionPageWrapper />} />
        <Route path="/monitoring" element={<DashboardPageWrapper Component={AgentHealthDashboard} />} />
        <Route path="/quota" element={<DashboardPageWrapper Component={StorageQuotaDashboard} />} />
        <Route path="/plans" element={<DashboardPageWrapper Component={PlanDisplay} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}


export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RecoveryProvider>
          <BrowserRouter>
            <AgentQueryCleaner />
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <AppRoutes />
            </div>
          </BrowserRouter>
        </RecoveryProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
