import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * History-aware "Back" navigation used by every page's back button.
 *
 * Returns a handler that goes to the *last visited screen* (browser history) whenever there is one,
 * so Back always returns wherever the user actually came from — a list, a search result, a task
 * detail — instead of a hardcoded parent page. The `fallback` route is used only when the page was
 * opened directly and there is no in-app history to go back to (e.g. a shared deep link, a fresh tab).
 */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    if (window.history.length > 2) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
