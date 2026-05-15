import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import LoginForm from '../components/LoginForm.jsx';
import RegisterForm from '../components/RegisterForm.jsx';

/**
 * AuthPage — renders login or register form.
 * Auth redirect is handled by AuthGuard wrapper in App.jsx,
 * so this component only needs to render the correct form.
 */
export default function AuthPage() {
  const { search } = useLocation();
  
  const params = new URLSearchParams(search);
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login';
  const errorMsg = params.get('error') === 'google_failed' ? 'Google Sign-In failed. Try again.' : '';

  const [authMode, setAuthMode] = useState(initialMode);
  
  const prefersReduced = useReducedMotion();
  const transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

  return (
    <>
      {errorMsg && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--red)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-md)', zIndex: 10 }}>
          {errorMsg}
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={authMode}
          initial={{ opacity: 0, x: authMode === 'login' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: authMode === 'login' ? 20 : -20 }}
          transition={transition}
          style={{ width: '100%', height: '100%' }}
        >
          {authMode === 'login'
            ? <LoginForm onSwitch={() => setAuthMode('register')} />
            : <RegisterForm onSwitch={() => setAuthMode('login')} />
          }
        </motion.div>
      </AnimatePresence>
    </>
  );
}
