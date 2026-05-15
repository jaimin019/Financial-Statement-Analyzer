import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/** Returns the auth context: { user, token, isAuthenticated, isLoading, login, logout, register } */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
