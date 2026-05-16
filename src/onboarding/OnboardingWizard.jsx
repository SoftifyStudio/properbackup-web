import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

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

function NameStep({ name, setName, onNext, onBack, loading, error }) {
  return (
    <div>
      <h2 className="text-text1 font-bold text-lg mb-1">Name your server</h2>
      <p className="text-text3 text-sm mb-5">Choose a recognizable name for this device (e.g. "my-minecraft-server", "nas-01").</p>
      <div className="mb-5">
        <input
          type="text"
          className="input"
          placeholder="my-server"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          autoFocus
        />
        {error && <p className="text-danger text-xs mt-2">{error}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={onNext} disabled={!name.trim() || loading}>
          {loading ? 'Generating...' : 'Continue'}
        </button>
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function InstallStep({ os, setOs, activationToken, onNext, onBack }) {
  const [copied, setCopied] = useState(false);

  const installCommands = {
    linux: `# Download agent
curl -Lo properbackup-agent.jar https://dl.properbackup.com/agent/latest/properbackup-agent.jar

# Activate with your token
java -jar properbackup-agent.jar --activate ${activationToken}

# Install as systemd service (auto-restart on boot)
java -jar properbackup-agent.jar --install-service`,
    macos: `# Download agent
curl -Lo properbackup-agent.jar https://dl.properbackup.com/agent/latest/properbackup-agent.jar

# Activate with your token
java -jar properbackup-agent.jar --activate ${activationToken}

# Install as launchd service (auto-start on login)
java -jar properbackup-agent.jar --install-service`,
    windows: `# Download agent (PowerShell)
Invoke-WebRequest -Uri "https://dl.properbackup.com/agent/latest/properbackup-agent.jar" -OutFile "properbackup-agent.jar"

# Activate with your token
java -jar properbackup-agent.jar --activate ${activationToken}

# Start agent (GUI mode)
java -jar properbackup-agent.jar --gui`,
  };

  const copy = () => {
    navigator.clipboard.writeText(installCommands[os]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-text1 font-bold text-lg mb-1">Install the agent</h2>
      <p className="text-text3 text-sm mb-4">Run these commands on the server you want to back up.</p>

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

      <div className="bg-[#1e1e1e] rounded-lg p-4 mb-4 relative">
        <pre className="text-[#d4d4d4] text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {installCommands[os]}
        </pre>
        <button
          type="button"
          className="absolute top-2 right-2 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition"
          onClick={copy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="bg-accentLight border border-accent/20 rounded-xl2 p-3 mb-5">
        <p className="text-accent text-xs leading-relaxed">
          <strong>Activation token:</strong> <code className="bg-accent/10 px-1 py-0.5 rounded text-[11px]">{activationToken}</code>
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={onNext}>I've installed it</button>
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function WaitingStep({ serverId, onDone, onBack }) {
  const { token } = useAuth();
  const [status, setStatus] = useState('waiting');
  const [dots, setDots] = useState('');

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    if (!token || !serverId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.lastSeenAt) {
          setStatus('connected');
        }
      } catch (_) { /* retry */ }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, serverId]);

  if (status === 'connected') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-text1 font-bold text-lg mb-2">Agent connected!</h2>
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
      <h2 className="text-text1 font-bold text-lg mb-2">Waiting for agent{dots}</h2>
      <p className="text-text3 text-sm mb-6">Run the commands from the previous step on your server. The agent will connect automatically once activated.</p>
      <button type="button" className="btn-ghost text-xs" onClick={onBack}>Go back to instructions</button>
    </div>
  );
}

export default function OnboardingWizard({ onComplete }) {
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
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
          <NameStep
            name={name}
            setName={setName}
            onNext={generateToken}
            onBack={() => setStep(0)}
            loading={loading}
            error={error}
          />
        )}
        {step === 2 && (
          <InstallStep
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
