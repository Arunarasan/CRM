import { useEffect, useState } from 'react';
import api from '@/lib/api';

/**
 * Standalone unread-notification-count poller for the mobile shell. Deliberately does NOT
 * touch DashboardLayout.tsx's own inline polling (desktop stays untouched) — this duplicates
 * the same /notifications/unread-count polling pattern for the new mobile layout only.
 */
export function useUnreadNotificationCount(pollMs = 30000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = () => {
      api.get('/notifications/unread-count')
        .then((res) => { if (!cancelled) setCount(res.data); })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, pollMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pollMs]);

  return count;
}
