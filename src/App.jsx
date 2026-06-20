import React, { useEffect } from 'react';
import { I18nProvider } from './i18n/I18nContext.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { RecoveryProvider } from './recovery/RecoveryContext.jsx';
import RecoveryMode from './recovery/RecoveryMode.jsx';
import AuthLanding from './auth/AuthLanding.jsx';
import ServersPage from './servers/ServersPage.jsx';
import BackupsPage from './servers/BackupsPage.jsx';
import SubscriptionPage from './subscription/SubscriptionPage.jsx';

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
            <RecoveryMode />
          </BrowserRouter>
        </RecoveryProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
