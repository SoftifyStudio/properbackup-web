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

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStored);

  const login = useCallback((data) => {
    // data: { token, email, id }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAuth(data);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user: auth,
      token: auth?.token ?? null,
      isSystemAdmin: !!auth?.isSystemAdmin,
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
