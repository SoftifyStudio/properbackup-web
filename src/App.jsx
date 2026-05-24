import React, { useEffect } from 'react';
import { I18nProvider } from './i18n/I18nContext.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import AuthLanding from './auth/AuthLanding.jsx';
import ServersPage from './servers/ServersPage.jsx';
import BackupsPage from './servers/BackupsPage.jsx';
import SubscriptionPage from './subscription/SubscriptionPage.jsx';
import PromoCodeAdmin from './subscription/PromoCodeAdmin.jsx';
import EmailVerifyPage from './auth/EmailVerifyPage.jsx';

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

function EmailVerifyRoute() {
  const { token, emailVerified } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const verifyToken = search.get('token');

  if (!token && !verifyToken) return <Navigate to="/login" replace />;

  if (emailVerified && !verifyToken) {
    return <Navigate to="/servers" replace />;
  }

  return <EmailVerifyPage verifyToken={verifyToken} />;
}

function AppRoutesInner() {
  const { token, emailVerified } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const serverId = params.serverId;
  const serverName = search.get('name') || serverId || '';

  if (!token) {
    return <AuthLanding />;
  }

  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />;
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

function PromoCodeAdminWrapper() {
  const { token } = useAuth();
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  return <PromoCodeAdmin onBack={() => navigate('/servers')} />;
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
        <Route path="/admin/promo-codes" element={<PromoCodeAdminWrapper />} />
        <Route path="/verify-email" element={<EmailVerifyRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}


export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AgentQueryCleaner />
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
