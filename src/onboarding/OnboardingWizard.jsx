import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();
const DL_BASE = 'https://dl.properbackup.com';

function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            i === current ? 'bg-accent scale-110' : i < current ? 'bg-accent/40' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-text1 font-bold text-xl mb-2">Welcome to ProperBackup</h2>
      <p className="text-text3 text-sm mb-8 max-w-sm mx-auto">
        Set up your first encrypted backup in under 2 minutes. Your files will be protected with AES-256-GCM encryption — only you hold the key.
      </p>
      <button type="button" className="btn-primary px-8 py-2.5 text-sm font-semibold" onClick={onNext}>
        Get started
      </button>
    </div>
  );
}

const SERVER_TYPES = [
  {
    id: 'minecraft',
    label: 'Minecraft Server',
    desc: 'Paper, Spigot, Fabric, Forge, Vanilla',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect x="7" y="7" width="4" height="4" />
        <rect x="13" y="7" width="4" height="4" />
        <rect x="9" y="13" width="6" height="4" />
      </svg>
    ),
  },
  {
    id: 'vps',
    label: 'VPS / Dedicated',
    desc: 'Linux server, cloud instance, bare metal',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="7" rx="1.5" />
        <rect x="2" y="14" width="20" height="7" rx="1.5" />
        <circle cx="6" cy="6.5" r="1" fill="currentColor" />
        <circle cx="6" cy="17.5" r="1" fill="currentColor" />
        <line x1="10" y1="6.5" x2="18" y2="6.5" strokeLinecap="round" />
        <line x1="10" y1="17.5" x2="18" y2="17.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

function SetupStep({ name, setName, serverType, setServerType, onNext, onBack, loading, error }) {
  return (
    <div>
      <h2 className="text-text1 font-bold text-lg mb-1">Set up your server</h2>
      <p className="text-text3 text-sm mb-5">What are you backing up?</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {SERVER_TYPES.map(t => (
          <button
            key={t.id}
            type="button"
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
              serverType === t.id
                ? 'border-accent bg-accentLight'
                : 'border-border bg-surface hover:border-text4'
            }`}
            onClick={() => setServerType(t.id)}
          >
            <div className={serverType === t.id ? 'text-accent' : 'text-text3'}>{t.icon}</div>
            <span className={`text-sm font-semibold ${serverType === t.id ? 'text-accent' : 'text-text1'}`}>{t.label}</span>
            <span className="text-[11px] text-text4 leading-tight">{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="mb-5">
        <label className="text-text2 text-xs font-medium mb-1.5 block">Server name</label>
        <input
          type="text"
          className="input"
          placeholder={serverType === 'minecraft' ? 'my-minecraft-server' : 'vps-01'}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          autoFocus
        />
        {error && <p className="text-danger text-xs mt-2">{error}</p>}
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={onNext} disabled={!name.trim() || !serverType || loading}>
          {loading ? 'Generating...' : 'Continue'}
        </button>
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

const CopyButton = memo(function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30'
      }`}
      onClick={copy}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
});

function MinecraftInstallStep({ activationToken, onNext, onBack }) {
  const pluginUrl = `${DL_BASE}/mc/latest/ProperBackup.jar`;
  const command = `/properbackup activate ${activationToken}`;

  return (
    <div>
      <h2 className="text-text1 font-bold text-lg mb-1">Install the plugin</h2>
      <p className="text-text3 text-sm mb-5">Two quick steps and your Minecraft server is protected.</p>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span className="text-text1 text-sm font-medium">Download the plugin</span>
        </div>
        <a
          href={pluginUrl}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all"
          download
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download ProperBackup.jar
        </a>
        <p className="text-text4 text-[11px] mt-1.5">Drop it into your server's <code className="bg-surface px-1 rounded">plugins/</code> folder and restart.</p>
      </div>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span className="text-text1 text-sm font-medium">Activate in server console</span>
        </div>
        <div className="bg-[#1e1e1e] rounded-lg p-4 mb-2">
          <pre className="text-[#d4d4d4] text-sm font-mono select-all">{command}</pre>
        </div>
        <CopyButton text={command} label="Copy command" />
      </div>

      <div className="bg-accentLight border border-accent/20 rounded-xl2 p-3 mb-5">
        <p className="text-accent text-xs leading-relaxed">
          <strong>Your activation token:</strong>{' '}
          <code className="bg-accent/10 px-1.5 py-0.5 rounded text-[11px] select-all">{activationToken}</code>
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={onNext}>I've activated it</button>
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function VpsInstallStep({ os, setOs, activationToken, onNext, onBack }) {
  const downloadUrl = os === 'windows'
    ? `${DL_BASE}/agent/latest/properbackup-agent-windows-x64.zip`
    : `${DL_BASE}/agent/latest/properbackup-agent-${os === 'macos' ? 'macos' : 'linux'}-x64.tar.gz`;

  const command = os === 'windows'
    ? `properbackup-agent.bat --activate ${activationToken}`
    : `./properbackup-agent --activate ${activationToken}`;

  const osLabel = os === 'windows' ? 'Windows' : os === 'macos' ? 'macOS' : 'Linux';

  return (
    <div>
      <h2 className="text-text1 font-bold text-lg mb-1">Install the agent</h2>
      <p className="text-text3 text-sm mb-4">Download, extract, run one command. Java is already included.</p>

      <div className="flex gap-1 mb-4">
        {[['linux', 'Linux'], ['macos', 'macOS'], ['windows', 'Windows']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
              os === id ? 'bg-accent text-white' : 'bg-surface text-text3 hover:text-text2'
            }`}
            onClick={() => setOs(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span className="text-text1 text-sm font-medium">Download the agent</span>
        </div>
        <a
          href={downloadUrl}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all"
          download
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download ProperBackup ({osLabel})
        </a>
        <p className="text-text4 text-[11px] mt-1.5">
          {os === 'windows' ? 'Extract the zip and open a terminal in that folder.' : 'Extract the archive and open a terminal in that folder.'}
        </p>
      </div>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span className="text-text1 text-sm font-medium">Run this command</span>
        </div>
        <div className="bg-[#1e1e1e] rounded-lg p-4 mb-2">
          <pre className="text-[#d4d4d4] text-sm font-mono select-all break-all whitespace-pre-wrap">{command}</pre>
        </div>
        <CopyButton text={command} label="Copy command" />
        <p className="text-text4 text-[11px] mt-1.5">Activates the agent and installs it as a background service (auto-restart on boot).</p>
      </div>

      <div className="bg-accentLight border border-accent/20 rounded-xl2 p-3 mb-5">
        <p className="text-accent text-xs leading-relaxed">
          <strong>Your activation token:</strong>{' '}
          <code className="bg-accent/10 px-1.5 py-0.5 rounded text-[11px] select-all">{activationToken}</code>
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={onNext}>I've run the command</button>
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

const WaitingStep = memo(function WaitingStep({ serverId, onDone, onBack }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(5);
  const [lastCheckResult, setLastCheckResult] = useState(null);
  const countdownRef = useRef(null);
  const checkingRef = useRef(false);

  const pollServer = useCallback(async () => {
    if (!token || !serverId || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLastCheckResult('not_found');
        return;
      }
      const data = await res.json();
      if (data.lastSeen || data.lastSeenAt) {
        setStatus('connected');
        setLastCheckResult('connected');
      } else {
        setLastCheckResult('not_detected');
      }
    } catch (_) {
      setLastCheckResult('error');
    } finally {
      checkingRef.current = false;
    }
  }, [token, serverId]);

  useEffect(() => {
    if (status === 'connected') return;
    pollServer();
  }, []);

  useEffect(() => {
    if (status === 'connected') return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          pollServer();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [status, pollServer]);

  const handleRefreshNow = useCallback(() => {
    setCountdown(5);
    pollServer();
  }, [pollServer]);

  if (status === 'connected') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-text1 font-bold text-lg mb-2">{t('countdown.agentConnected')}</h2>
        <p className="text-text3 text-sm mb-6">Your server is now being backed up. Files are encrypted locally before upload — your password never leaves the device.</p>
        <button type="button" className="btn-primary px-8 py-2.5 text-sm font-semibold" onClick={onDone}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
        <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-text1 font-bold text-lg mb-2">{t('countdown.waitingForActivation')}</h2>
      <p className="text-text3 text-sm mb-4">Run the command from the previous step on your server. The agent will connect automatically.</p>

      {/* Countdown ticker + Refresh Now */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleRefreshNow}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('countdown.refreshNow')}
        </button>
        <span className="text-xs text-text4 tabular-nums min-w-[120px]">
          {t('countdown.refreshingIn', { seconds: countdown })}
        </span>
      </div>

      {/* Last check result */}
      {lastCheckResult === 'not_detected' && (
        <p className="text-xs text-amber-600 mb-4">{t('countdown.agentNotDetected')}</p>
      )}

      <button type="button" className="btn-ghost text-xs" onClick={onBack}>Go back to instructions</button>
    </div>
  );
});

export default function OnboardingWizard({ onComplete }) {
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [serverType, setServerType] = useState('minecraft');
  const [os, setOs] = useState(detectOS);
  const [activationToken, setActivationToken] = useState('');
  const [serverId, setServerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateToken = async () => {
    if (!name.trim()) {
      setError('Please enter a server name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/generate-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setActivationToken(data.token);
      setServerId(data.serverId || name.trim());
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="bg-panel rounded-2xl shadow-xl border border-border w-full max-w-lg p-8">
        <StepDots current={step} total={4} />

        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
        {step === 1 && (
          <SetupStep
            name={name}
            setName={setName}
            serverType={serverType}
            setServerType={setServerType}
            onNext={generateToken}
            onBack={() => setStep(0)}
            loading={loading}
            error={error}
          />
        )}
        {step === 2 && serverType === 'minecraft' && (
          <MinecraftInstallStep
            activationToken={activationToken}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 2 && serverType === 'vps' && (
          <VpsInstallStep
            os={os}
            setOs={setOs}
            activationToken={activationToken}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <WaitingStep
            serverId={serverId}
            onDone={onComplete}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
