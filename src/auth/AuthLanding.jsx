import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import PasswordStrengthPanel from './PasswordStrengthPanel.jsx';
import { isPasswordAcceptable, passwordChecks, PASSWORD_MIN_LENGTH } from './passwordPolicy.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { boldPartsReact } from '../i18n/bold.jsx';
import LanguageMenu from '../layout/LanguageMenu.jsx';

const BASE_URL = bufferBaseUrl();

function readSearchAgent() {
  const q = new URLSearchParams(window.location.search);
  return {
    agent: q.get('agent') === '1',
    machineId: q.get('machineId') || '',
    unlinked: q.get('unlinked') === '1',
    needsLogin: q.get('needsLogin') === '1',
  };
}

function readHashActivationKey() {
  const h = window.location.hash.replace(/^#/, '');
  if (!h) return '';
  if (h.toLowerCase().startsWith('a=')) return decodeURIComponent(h.slice(2)).trim();
  const sp = new URLSearchParams(h.startsWith('?') ? h.slice(1) : h);
  return (sp.get('a') || sp.get('activate') || '').trim();
}

function stripActivationHashFromUrl() {
  const raw = window.location.hash;
  if (!raw || !/^#a=/i.test(raw)) return;
  const path = window.location.pathname + window.location.search;
  window.history.replaceState({}, document.title, path);
}

export default function AuthLanding() {
  const { login } = useAuth();
  const { t } = useI18n();
  const agent = useMemo(() => readSearchAgent(), []);

  const staticRuleDescriptions = useMemo(
    () =>
      passwordChecks('', (id) =>
        id === 'len' ? t('password.rules.len', { min: PASSWORD_MIN_LENGTH }) : t(`password.rules.${id}`),
      ),
    [t],
  );

  const [tab, setTab] = useState(() => {
    if (!agent.agent) return 'login';
    if (agent.needsLogin) return 'login';
    return 'activate';
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const [actKey, setActKey] = useState(() => readHashActivationKey());
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState('');

  useEffect(() => {
    stripActivationHashFromUrl();
  }, []);

  const regPasswordOk = isPasswordAcceptable(regPassword);
  const regEmailOk = regEmail.trim().length > 0;
  const regCanSubmit = regEmailOk && regPasswordOk;

  const loginCanSubmit = loginEmail.trim().length > 0 && loginPassword.length > 0;
  const actCanSubmit = actKey.trim().replace(/\s+/g, '').length >= 14;

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError(t('auth.loginMissing'));
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        await res.text().catch(() => '');
        setLoginError(t('auth.loginWrong'));
        return;
      }
      login(await res.json());
      if (agent.agent) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      setLoginError(t('auth.loginNetwork'));
    } finally {
      setLoginLoading(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!regEmail || !regPassword) {
      setRegError(t('auth.regMissing'));
      return;
    }
    if (!isPasswordAcceptable(regPassword)) {
      setRegError(t('auth.regPwWeak'));
      return;
    }
    setRegLoading(true);
    setRegError('');
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setRegError(txt && txt.length < 220 ? txt : t('auth.regFail'));
        return;
      }
      login(await res.json());
      if (agent.agent) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      setRegError(t('auth.regNetwork'));
    } finally {
      setRegLoading(false);
    }
  };

  const submitActivate = async (e) => {
    e.preventDefault();
    const tok = actKey.trim().replace(/\s+/g, '');
    if (!tok) {
      setActError(t('auth.activateMissing'));
      return;
    }
    setActLoading(true);
    setActError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tok,
          hostname: 'properbackup-web',
          includeAuth: true,
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        setActError(raw && raw.length < 280 ? raw : t('auth.errorStatus', { status: res.status }));
        return;
      }
      const data = JSON.parse(raw);
      if (data.token && data.email) {
        login({
          token: data.token,
          email: data.email,
          id: data.id,
          isSystemAdmin: !!data.isSystemAdmin,
        });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      setActError(t('auth.activateNetwork'));
    } finally {
      setActLoading(false);
    }
  };

  const tabBtn = (id, labelKey, icon) => {
    const active = tab === id;
    const size = showAgentTabs
      ? 'min-h-[3.35rem] w-full min-w-0 gap-2 px-2.5 text-sm sm:min-h-[3.55rem] sm:gap-2.5 sm:px-5 sm:text-base'
      : 'flex-1 gap-1.5 py-3 px-1.5 text-sm sm:gap-2 sm:py-3.5 sm:text-base';
    const tone = active
      ? 'text-white bg-accent shadow-md shadow-accent/25 ring-2 ring-accent/30'
      : 'text-text2 bg-panel border border-border hover:bg-accentLight/40 hover:border-accent/25';
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTab(id)}
        className={`relative flex items-center justify-center font-semibold rounded-xl transition-all duration-200 ease-out ${size} ${tone}`}
      >
        {icon}
        <span className="leading-tight text-center whitespace-normal sm:whitespace-nowrap">{t(labelKey)}</span>
      </button>
    );
  };

  const showAgentTabs = agent.agent;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden relative bg-surface">
      <div className="auth-aurora pointer-events-none" aria-hidden="true" />
      <div className="auth-aurora auth-aurora--2 pointer-events-none" aria-hidden="true" />

      <div className="relative z-[12] shrink-0 flex justify-end px-4 pt-3 sm:absolute sm:inset-x-0 sm:top-0 sm:justify-end sm:px-6 sm:pt-3.5">
        <LanguageMenu />
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 py-8">
        <div
          className={`w-full animate-fade-up shrink-0 ${showAgentTabs ? 'max-w-3xl xl:max-w-4xl' : 'max-w-[440px]'}`}
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent shadow-lg shadow-accent/25 mb-4 ring-4 ring-white/60">
              <svg className="w-7 h-7 text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 5a2 2 0 012-2h3l1.5 1.5H12a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="text-text1 font-bold text-2xl tracking-tight mb-2">ProperBackup</h1>
            <p
              className={`text-text3 text-sm mx-auto leading-relaxed ${
                showAgentTabs ? 'max-w-2xl' : 'max-w-sm'
              }`}
            >
              {showAgentTabs ? t('auth.taglineAgent') : t('auth.taglineDefault')}
            </p>
            {showAgentTabs && (
              <p className="text-text4 text-[11px] mt-2 max-w-2xl mx-auto leading-relaxed break-all">
                {t('auth.machineId')} <span className="text-text2 font-mono">{agent.machineId || t('common.dash')}</span>
                {agent.unlinked && <span className="block mt-1 text-warn">{t('auth.unlinkedNote')}</span>}
              </p>
            )}
          </div>

          <div className="bg-panel rounded-2xl border-2 border-border shadow-card p-1.5 mb-5 shrink-0 ring-1 ring-black/[0.04]">
            <div
              className={`rounded-xl bg-surface p-1 ${showAgentTabs ? 'grid grid-cols-3 gap-1.5 sm:gap-2' : 'flex gap-1'}`}
            >
              {tabBtn('login', 'auth.tabLogin', (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V7H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd"/>
                </svg>
              ))}
              {tabBtn('register', 'auth.tabRegister', (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm11-3a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V8z"/>
                </svg>
              ))}
              {showAgentTabs && tabBtn('activate', 'auth.tabActivate', (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                </svg>
              ))}
            </div>
          </div>

          <div className="relative min-h-[200px] shrink-0">
            <div
              className={`transition-all duration-300 ease-out ${
                tab === 'login'
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-3 pointer-events-none absolute inset-x-0 top-0'
              }`}
            >
              <div className="bg-panel/95 backdrop-blur-md rounded-2xl border border-border/80 shadow-card p-6">
                <p className="text-text2 text-sm mb-5 text-center">
                  {showAgentTabs && agent.needsLogin ? t('auth.loginHintAgentNeedsLogin') : t('auth.loginHintDefault')}
                </p>
                <form onSubmit={submitLogin} className="space-y-4">
                  <div>
                    <label className="block text-text2 text-sm font-medium mb-1.5">{t('auth.emailLabel')}</label>
                    <input
                      type="email"
                      className="input"
                      placeholder={t('auth.emailPlaceholder')}
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-text2 text-sm font-medium mb-1.5">{t('auth.passwordLabel')}</label>
                    <input
                      type="password"
                      className="input"
                      placeholder={t('auth.passwordPlaceholder')}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <div className="mt-3 rounded-xl2 border border-border bg-surface px-3 py-2.5 text-left">
                      <p className="text-[11px] text-text3 leading-relaxed mb-2">
                        {boldPartsReact(t('password.loginRulesIntro'))}
                      </p>
                      <ul className="space-y-1.5 text-[11px] leading-snug border-t border-border/70 pt-2.5">
                        {staticRuleDescriptions.map((r) => (
                          <li key={r.id} className="flex items-start gap-2 text-text3">
                            <span
                              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border bg-surface"
                              aria-hidden="true"
                            />
                            <span>{r.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {loginError && <p className="text-danger text-xs text-center">{loginError}</p>}
                  <button
                    type="submit"
                    className="btn-primary w-full py-3 text-[15px] leading-snug disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none"
                    disabled={loginLoading || !loginCanSubmit}
                  >
                    {loginLoading
                      ? t('auth.loggingIn')
                      : loginCanSubmit
                        ? t('auth.loginSubmitIdle')
                        : t('auth.loginSubmitNeed')}
                  </button>
                </form>
              </div>
            </div>

            <div
              className={`transition-all duration-300 ease-out ${
                tab === 'register'
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-3 pointer-events-none absolute inset-x-0 top-0'
              }`}
            >
              <div className="bg-panel/95 backdrop-blur-md rounded-2xl border border-accent/15 shadow-card p-6 ring-1 ring-accent/10">
                <p className="text-text2 text-sm mb-4 text-center leading-relaxed">
                  {boldPartsReact(t('auth.registerIntro'))}
                </p>
                <form onSubmit={submitRegister} className="space-y-4">
                  <div>
                    <label className="block text-text2 text-sm font-medium mb-1.5">{t('auth.emailLabel')}</label>
                    <input
                      type="email"
                      className="input"
                      placeholder={t('auth.regEmailPlaceholder')}
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-text2 text-sm font-medium mb-1.5">{t('auth.passwordLabel')}</label>
                    <input
                      type="password"
                      className={`input transition-[border-color,box-shadow] duration-200 ${
                        regPassword.length === 0
                          ? ''
                          : regPasswordOk
                            ? 'border-success/55 ring-1 ring-success/15'
                            : 'border-warn/45 ring-1 ring-warn/12'
                      }`}
                      placeholder={t('auth.placeholderNewPassword')}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={regPassword.length > 0 && !regPasswordOk}
                    />
                    <PasswordStrengthPanel value={regPassword} />
                  </div>
                  {regError && <p className="text-danger text-xs text-center">{regError}</p>}
                  <button
                    type="submit"
                    className="btn-primary w-full py-3 text-[15px] leading-snug disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none"
                    disabled={regLoading || !regCanSubmit}
                  >
                    {regLoading
                      ? t('auth.creatingAccount')
                      : regCanSubmit
                        ? t('auth.registerSubmitOk')
                        : !regEmailOk
                          ? t('auth.registerSubmitNeedEmail')
                          : t('auth.registerSubmitFixPw')}
                  </button>
                </form>
              </div>
            </div>

            {showAgentTabs && (
              <div
                className={`transition-all duration-300 ease-out ${
                  tab === 'activate'
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-3 pointer-events-none absolute inset-x-0 top-0'
                }`}
              >
                <div className="bg-panel/95 backdrop-blur-md rounded-2xl border border-accent/20 shadow-card p-6 ring-1 ring-accent/10">
                  <p className="text-text2 text-sm mb-4 text-center leading-relaxed">
                    {boldPartsReact(t('auth.activateIntro'))}
                  </p>
                  <form onSubmit={submitActivate} className="space-y-4">
                    <div>
                      <label className="block text-text2 text-sm font-medium mb-1.5">{t('auth.activateKeyLabel')}</label>
                      <input
                        type="text"
                        className="input font-mono tracking-wide"
                        placeholder={t('auth.activatePlaceholder')}
                        value={actKey}
                        onChange={e => setActKey(e.target.value.toUpperCase())}
                        autoComplete="off"
                        spellCheck="false"
                      />
                    </div>
                    {actError && <p className="text-danger text-xs text-center">{actError}</p>}
                    <button
                      type="submit"
                      className="btn-primary w-full py-3 text-[15px] leading-snug disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none"
                      disabled={actLoading || !actCanSubmit}
                    >
                      {actLoading ? t('auth.activating') : t('auth.activateSubmit')}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <p
            className={`text-center text-text4 text-[11px] mt-6 pb-4 leading-relaxed mx-auto shrink-0 ${
              showAgentTabs ? 'max-w-2xl' : 'max-w-xs'
            }`}
          >
            {tab === 'activate' ? t('auth.footerActivate') : t('auth.footerGeneral')}
          </p>
        </div>
      </div>
    </div>
  );
}
