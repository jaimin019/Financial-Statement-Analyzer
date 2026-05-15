import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Toast notification component.
 * Fixed position top-center. Auto-dismisses after 4s.
 * Usage: <Toast message="..." type="success|error" onDismiss={() => setMsg(null)} />
 */
export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className={`toast toast-${type}`}
          initial={{ opacity: 0, y: -32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          <span className="toast-icon">
            {type === 'success' ? '✓' : '✕'}
          </span>
          <span className="toast-message">{message}</span>
          <button className="toast-close" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook for toast state management.
 * Returns [toastProps, showToast] where showToast(message, type) triggers the toast.
 */
export function useToast() {
  const [toast, setToast] = useState({ message: null, type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const dismiss = useCallback(() => {
    setToast({ message: null, type: 'success' });
  }, []);

  return [{ message: toast.message, type: toast.type, onDismiss: dismiss }, showToast];
}
