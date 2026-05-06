import React, { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEY } from './storage.js';

const AuthContext = createContext(null);

function loadStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function computeTrialDaysLeft(auth) {
  if (!auth) return null;
  if (auth.subscriptionPlan) return null;
  const exp = auth.trialExpiresAt;
  if (!exp) return null;
  const ms = new Date(exp).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStored);

  const login = useCallback((data) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAuth(data);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const trialDaysLeft = computeTrialDaysLeft(auth);
  const isTrialExpired = trialDaysLeft !== null && trialDaysLeft <= 0 && !auth?.subscriptionPlan;
  const isTrialActive = trialDaysLeft !== null && trialDaysLeft > 0;

  return (
    <AuthContext.Provider value={{
      user: auth,
      token: auth?.token ?? null,
      isSystemAdmin: !!auth?.isSystemAdmin,
      trialDaysLeft,
      isTrialExpired,
      isTrialActive,
      subscriptionPlan: auth?.subscriptionPlan ?? null,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
