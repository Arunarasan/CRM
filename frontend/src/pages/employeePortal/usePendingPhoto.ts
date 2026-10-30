import { useCallback, useEffect, useState } from 'react';
import { employeePortalApi } from '@/api/employeePortalApi';

/**
 * The employee's profile photo waiting for admin approval (shown on mobile meanwhile), plus the
 * remarks of the latest rejected photo so the portal can explain why the old photo is back.
 */
export function usePendingPhoto() {
  const [pending, setPending] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  const reload = useCallback(() => {
    employeePortalApi.profileChangeRequests().then((rs) => {
      const withPhoto = rs.filter((r) => r.changeType === 'PROFILE' && r.proposedPhotoUrl);
      const latest = withPhoto[0]; // API returns newest first
      setPending(latest?.status === 'PENDING' ? latest.proposedPhotoUrl : null);
      setRejected(latest?.status === 'REJECTED' ? (latest.reviewRemarks || 'Not approved') : null);
    }).catch(() => { setPending(null); setRejected(null); });
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { pending, rejected, reload };
}
