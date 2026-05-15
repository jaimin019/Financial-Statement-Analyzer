import { createContext, useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiLogin, apiRegister, apiLogout } from '../services/api.js';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'fsa_token';

function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

function getUserFromToken(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

/**
 * Reads token from localStorage SYNCHRONOUSLY in useState initializer.
 * This means isLoading is never true on refresh — auth state is known
 * immediately. No flash of login page on page refresh.
 */
function initToken() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored && !isTokenExpired(stored)) return stored;
  if (stored) localStorage.removeItem(TOKEN_KEY);
  return null;
}

function initUser() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored && !isTokenExpired(stored)) return getUserFromToken(stored);
  return null;
}

export function AuthProvider({ children }) {
  // Synchronous init from localStorage — no async, no isLoading flash
  const [token, setToken] = useState(initToken);
  const [user, setUser] = useState(initUser);

  // isLoading is false by default because we read localStorage synchronously.
  // No flash of redirect to /auth on refresh.
  const isLoading = false;

  const storeToken = useCallback((newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(getUserFromToken(newToken));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    storeToken(data.token);
    return data;
  }, [storeToken]);

  const register = useCallback(async (email, password) => {
    const data = await apiRegister(email, password);
    storeToken(data.token);
    return data;
  }, [storeToken]);

  const loginWithToken = useCallback((newToken) => {
    storeToken(newToken);
  }, [storeToken]);

  const logout = useCallback(async () => {
    // Clear auth state first
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);

    // Call logout endpoint (best-effort, don't block)
    apiLogout().catch(() => {});

    // Navigation is handled by the component calling logout,
    // not here — keeps AuthContext independent of react-router.
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        loginWithToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
