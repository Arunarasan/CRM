import { useEffect, useState } from 'react';
import { attendanceApi } from '@/api/attendanceApi';

/** Number of clock-ins waiting for an admin; polls every minute. Returns 0 when not allowed. */
export function usePendingAttendanceCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => attendanceApi.pendingCount().then((n) => { if (alive) setCount(n); }).catch(() => {});
    tick();
    const t = window.setInterval(tick, 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, [enabled]);
  return count;
}
