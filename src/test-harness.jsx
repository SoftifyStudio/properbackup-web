import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx';
import AgentIndexBanner from './servers/AgentIndexBanner.jsx';
import ErrorBoundary from './servers/ErrorBoundary.jsx';
import './index.css';

function LocaleToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex gap-2 items-center text-sm">
      <span className="text-text3">Locale:</span>
      <button
        onClick={() => setLocale('en')}
        className={`px-3 py-1 rounded ${locale === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
      >EN</button>
      <button
        onClick={() => setLocale('pl')}
        className={`px-3 py-1 rounded ${locale === 'pl' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
      >PL</button>
    </div>
  );
}

function BrokenComponent() {
  throw new Error('Intentional test crash to verify ErrorBoundary');
}

const MOCK_FILES = [
  '/var/www/html/index.html',
  '/var/www/html/assets/style.css',
  '/var/www/html/assets/app.js',
  '/var/www/html/assets/logo.svg',
  '/var/www/html/config/database.yml',
  '/var/www/html/config/routes.rb',
  '/var/www/html/public/favicon.ico',
  '/var/www/html/public/robots.txt',
  '/var/www/html/src/main.ts',
  '/var/www/html/src/utils/helpers.ts',
  '/var/www/html/src/components/Header.tsx',
  '/var/www/html/src/components/Footer.tsx',
];

function LiveFileListDemo() {
  const { t, formatDateTime } = useI18n();
  const [files, setFiles] = useState([]);
  const [sortMode, setSortMode] = useState('recent');

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      if (idx >= MOCK_FILES.length) {
        idx = 0;
        setFiles([]);
        return;
      }
      setFiles(prev => [
        { fullPath: MOCK_FILES[idx], status: 'current', updatedAt: new Date().toISOString() },
        ...prev,
      ]);
      idx++;
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const sorted = sortMode === 'path'
    ? [...files].sort((a, b) => a.fullPath.localeCompare(b.fullPath))
    : files;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-text4">{t('backups.filesSortLabel')}</span>
        <button
          className={`text-xs px-2 py-1 rounded ${sortMode === 'recent' ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2'}`}
          onClick={() => setSortMode('recent')}
        >{t('backups.filesSortRecent')}</button>
        <button
          className={`text-xs px-2 py-1 rounded ${sortMode === 'path' ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2'}`}
          onClick={() => setSortMode('path')}
        >{t('backups.filesSortPath')}</button>
      </div>
      <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-surface/90 border-b border-border">
            <tr>
              <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-text4">{t('backups.filesColPath')}</th>
              <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-text4 w-[7rem]">{t('backups.filesColStatus')}</th>
              <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-text4 w-[10.5rem]">{t('backups.filesColUpdated')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map(r => {
              const isRecent = r.updatedAt && (Date.now() - new Date(r.updatedAt).getTime()) < 10000;
              return (
                <tr key={r.fullPath} className={`transition-colors ${isRecent ? 'bg-accent/[0.06]' : 'hover:bg-surface/50'}`}>
                  <td className="py-1.5 px-3 font-mono text-[12px] text-text2 leading-snug align-middle">
                    {isRecent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 align-middle" />}
                    {r.fullPath}
                  </td>
                  <td className="py-1.5 px-3 text-text2 align-middle">{r.status}</td>
                  <td className="py-1.5 px-3 text-text3 tabular-nums text-[12px] align-middle">{formatDateTime(r.updatedAt)}</td>
                </tr>
              );
            })}
            {files.length === 0 && (
              <tr><td className="py-4 px-3 text-text4 text-sm" colSpan={3}>{t('backups.filesEmpty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestHarness() {
  const [simProgress, setSimProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSimProgress(p => (p >= 2780 ? 0 : p + 47));
    }, 800);
    return () => clearInterval(id);
  }, []);

  const scenarios = [
    {
      label: '1. Indexing — determinate progress (Tahoe style)',
      props: {
        serverName: 'Test VPS',
        agentStatus: {
          phase: 'indexing',
          detail: 'Skan dysku: /var/www',
          updatedAt: new Date().toISOString(),
          totalFiles: 2780,
          scannedFiles: simProgress,
          currentFile: 'var/www/html/assets/style.css',
        },
        rootsCount: 2,
        totalFiles: 2780,
        loading: false,
        variant: 'spotlight',
      },
    },
    {
      label: '2. Indexing — indeterminate (no progress data, old agent)',
      props: {
        serverName: 'Old Agent VPS',
        agentStatus: {
          phase: 'indexing',
          detail: 'Skan dysku: /home/minecraft',
          updatedAt: new Date(Date.now() - 3000).toISOString(),
        },
        rootsCount: 1,
        totalFiles: 500,
        loading: false,
        variant: 'spotlight',
      },
    },
    {
      label: '3. Uploading',
      props: {
        serverName: 'Upload Server',
        agentStatus: {
          phase: 'uploading',
          detail: 'Pakowanie kopii: /var/www (12 plików)',
          updatedAt: new Date(Date.now() - 1200).toISOString(),
          totalFiles: 1500,
          scannedFiles: 1500,
        },
        rootsCount: 3,
        totalFiles: 1500,
        loading: false,
        variant: 'spotlight',
      },
    },
    {
      label: '4. Idle — index ready',
      props: {
        serverName: 'Raspberry Pi',
        agentStatus: {
          phase: 'idle',
          detail: 'Oczekiwanie · następny skan za ok. 120 s',
          updatedAt: new Date(Date.now() - 45000).toISOString(),
        },
        rootsCount: 2,
        totalFiles: 834,
        loading: false,
        variant: 'spotlight',
      },
    },
    {
      label: '5. Waiting for configuration',
      props: {
        serverName: 'New Server',
        agentStatus: {
          phase: 'waiting',
          detail: 'Uzupełnij agent.server_id',
          updatedAt: new Date(Date.now() - 120000).toISOString(),
        },
        rootsCount: 0,
        totalFiles: 0,
        loading: false,
        variant: 'spotlight',
      },
    },
    {
      label: '6. No signal (null agentStatus)',
      props: {
        serverName: 'Offline VPS',
        agentStatus: null,
        rootsCount: 0,
        totalFiles: 0,
        loading: false,
        variant: 'spotlight',
      },
    },
  ];

  return (
    <I18nProvider>
      <div className="min-h-screen bg-surface p-6 space-y-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text1">AgentIndexBanner — Test Harness</h1>
        <LocaleToggle />
        <p className="text-sm text-text3">
          Scenario 1 simulates live scanning progress (auto-incrementing every 800ms).
        </p>

        {scenarios.map((s, i) => (
          <div key={i} className="space-y-2">
            <h2 className="text-sm font-semibold text-text2">{s.label}</h2>
            <AgentIndexBanner {...s.props} />
          </div>
        ))}

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text2">7. Live file list — files appearing during indexing</h2>
          <AgentIndexBanner
            serverName="Live Scan VPS"
            agentStatus={{
              phase: 'indexing',
              detail: 'Skan dysku: /var/www',
              updatedAt: new Date().toISOString(),
              totalFiles: 2780,
              scannedFiles: simProgress,
              currentFile: MOCK_FILES[Math.floor(simProgress / 47) % MOCK_FILES.length],
            }}
            rootsCount={2}
            totalFiles={2780}
            loading={false}
            variant="spotlight"
          />
          <LiveFileListDemo />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text2">8. ErrorBoundary — crash recovery</h2>
          <ErrorBoundary title="Component crashed" retryLabel="Try again">
            <BrokenComponent />
          </ErrorBoundary>
        </div>
      </div>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TestHarness />
  </React.StrictMode>,
);
