import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { downloadObject } from '../api/bufferClient.js';
import { verifyPassword, BadPasswordError } from '../crypto/headerVerify.js';
import { decryptAndDownload } from '../crypto/streamingDecrypt.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import ThawProgress from './ThawProgress.jsx';

/**
 * The wizard is launched from two places with different snapshot shapes:
 *  - per-file tree restore: { snap: { raw, timestamp }, node: { fullPath, pathId } }
 *  - snapshot-level restore (Timeline): { snap: { objectName, sealedAt, ... }, node: null }
 * These helpers normalize both so the wizard works (and never null-derefs `node`).
 */
function objectNameOf(snapshot) {
  return snapshot?.snap?.raw ?? snapshot?.snap?.objectName ?? '';
}
function timestampOf(snapshot) {
  return snapshot?.snap?.timestamp ?? snapshot?.snap?.sealedAt ?? null;
}
function pathLabelOf(snapshot, t) {
  const node = snapshot?.node;
  if (node?.fullPath) return node.fullPath;
  if (node?.pathId != null) return `[${node.pathId}]`;
  return t('recovery.wizard.entireSnapshotPath');
}

function StepIndicator({ current, labels }) {
  return (
    <div className="flex items-center mb-8">
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
              ${
                i < current
                  ? 'bg-accent text-white'
                  : i === current
                    ? 'bg-accentLight text-accent border-2 border-accent'
                    : 'bg-surface text-text4 border-2 border-border'
              }`}
            >
              {i < current ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs whitespace-nowrap ${i === current ? 'text-accent font-medium' : 'text-text4'}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < current ? 'bg-accent' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <span className="text-text3 text-sm">{label}</span>
      <span className={`text-text1 text-sm font-medium text-right max-w-xs truncate ${mono ? 'font-mono text-xs text-text3' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Step0({ snapshot, onNext }) {
  const { t, formatDateTime } = useI18n();
  const ts = timestampOf(snapshot);
  const dateStr =
    ts && typeof ts.toISOString === 'function'
      ? formatDateTime(ts.toISOString())
      : ts
        ? formatDateTime(new Date(ts).toISOString())
        : t('common.dash');

  return (
    <div>
      <h3 className="text-text1 font-semibold text-base mb-1">{t('recovery.wizard.step0Title')}</h3>
      <p className="text-text3 text-sm mb-5">{t('recovery.wizard.step0Intro')}</p>
      <div className="bg-surface rounded-lg px-4 mb-6">
        <InfoRow label={t('recovery.wizard.pathLabel')} value={pathLabelOf(snapshot, t)} />
        <InfoRow label={t('recovery.wizard.snapshotDateLabel')} value={dateStr} />
        <InfoRow label={t('recovery.wizard.fileLabel')} value={objectNameOf(snapshot)} mono />
      </div>
      <button type="button" className="btn-primary" onClick={onNext}>
        {t('recovery.wizard.nextPassword')}
      </button>
    </div>
  );
}

function Step1({ snapshot, onNext, onCancel, sessionToken }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const verify = async () => {
    if (!password) {
      setError(t('recovery.common.enterPassword'));
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const buf = await downloadObject(objectNameOf(snapshot), sessionToken);
      await verifyPassword(password, buf);
      onNext(password);
    } catch (e) {
      if (e instanceof BadPasswordError) {
        setError(t('recovery.common.badPasswordProp'));
      } else {
        setError(t('recovery.common.downloadError', { message: e.message }));
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <h3 className="text-text1 font-semibold text-base mb-1">{t('recovery.wizard.step1Title')}</h3>
      <p className="text-text3 text-sm mb-5">{t('recovery.wizard.step1Body')}</p>
      <div className="mb-5">
        <label className="block text-text2 text-sm font-medium mb-1.5">{t('recovery.common.encryptionPassword')}</label>
        <input
          type="password"
          className="input"
          placeholder={t('recovery.common.passwordPlaceholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verify()}
          autoFocus
        />
        {error && <p className="text-danger text-xs mt-2">{error}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn-primary" onClick={verify} disabled={verifying}>
          {verifying ? t('recovery.wizard.verifyBusy') : t('recovery.wizard.verifySubmit')}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t('recovery.common.cancel')}
        </button>
      </div>
    </div>
  );
}

function Step2({ onNext }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="text-text1 font-semibold text-base mb-2">{t('recovery.wizard.step2Title')}</h3>
      <p className="text-text3 text-sm mb-5">{t('recovery.wizard.step2Body')}</p>
      <ThawProgress onReady={onNext} mockMode={true} />
    </div>
  );
}

function Step3({ snapshot, password, onDone, sessionToken }) {
  const { t } = useI18n();
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  const download = async () => {
    setState('downloading');
    try {
      const objectName = objectNameOf(snapshot);
      const buf = await downloadObject(objectName, sessionToken);
      const filename = objectName.replace('.enc', '.tar.gz');
      await decryptAndDownload(password, buf, filename);
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('error');
    }
  };

  return (
    <div>
      <h3 className="text-text1 font-semibold text-base mb-1">{t('recovery.wizard.step3Title')}</h3>
      <p className="text-text3 text-sm mb-5">{t('recovery.wizard.step3Intro')}</p>

      <div className="bg-accentLight border border-accent/20 rounded-xl2 p-4 mb-5">
        <p className="text-accent text-sm font-semibold mb-1">{t('recovery.wizard.localDecryptTitle')}</p>
        <p className="text-text2 text-sm">{t('recovery.wizard.localDecryptBody')}</p>
      </div>

      {state === 'idle' && (
        <button type="button" className="btn-primary" onClick={download}>
          {t('recovery.wizard.downloadDecryptBtn')}
        </button>
      )}

      {state === 'downloading' && (
        <div className="flex items-center gap-3 text-text3 text-sm">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
          {t('recovery.wizard.decryptBusy')}
        </div>
      )}

      {state === 'done' && (
        <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-success" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-success text-sm font-semibold">{t('recovery.wizard.downloadedTitle')}</p>
          </div>
          <p className="text-text2 text-sm">{t('recovery.common.fileSaved')}</p>
          <button type="button" className="btn-ghost mt-3 text-xs" onClick={onDone}>
            {t('recovery.common.close')}
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4">
          <p className="text-danger text-sm font-semibold mb-1">{t('recovery.common.error')}</p>
          <p className="text-text2 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function RecoveryWizard({ snapshot, onClose }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');

  const stepLabels = useMemo(
    () => [
      t('recovery.wizard.steps.snapshot'),
      t('recovery.wizard.steps.password'),
      t('recovery.wizard.steps.thaw'),
      t('recovery.wizard.steps.download'),
    ],
    [t],
  );

  if (!snapshot) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-text1 font-bold text-lg">{t('recovery.wizard.title')}</h2>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface transition-colors"
            onClick={onClose}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <StepIndicator current={step} labels={stepLabels} />

        {step === 0 && <Step0 snapshot={snapshot} onNext={() => setStep(1)} />}
        {step === 1 && (
          <Step1
            snapshot={snapshot}
            sessionToken={token}
            onNext={(pw) => {
              setPassword(pw);
              setStep(2);
            }}
            onCancel={onClose}
          />
        )}
        {step === 2 && <Step2 onNext={() => setStep(3)} />}
        {step === 3 && <Step3 snapshot={snapshot} password={password} sessionToken={token} onDone={onClose} />}
      </div>
    </div>
  );
}
