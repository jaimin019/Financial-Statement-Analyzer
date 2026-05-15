import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const positions = {};

/**
 * ScrollRestoration — saves and restores scroll positions per route.
 * Place once inside BrowserRouter. On forward navigation, scrolls to top.
 * On back navigation, restores the previous scroll position.
 */
export default function ScrollRestoration() {
  const { pathname, key } = useLocation();

  useEffect(() => {
    // On unmount (navigation away), save current scroll position
    return () => {
      positions[key] = window.scrollY;
    };
  }, [key]);

  useEffect(() => {
    // On arrival, restore saved position or scroll to top
    const saved = positions[key];
    if (saved !== undefined) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, key]);

  return null;
}
