import { useState } from 'react';
import { MapPin, LogIn, LogOut } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { CheckInSummary } from '@/types/employeeTask';

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null), // GPS is optional per spec — fail gracefully, still allow check-in/out
      { timeout: 5000 },
    );
  });
}

export default function CheckInBar({ taskId, checkins, onChanged }: { taskId: number; checkins: CheckInSummary[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const openCheckIn = checkins.find((c) => c.checkInTime && !c.checkOutTime);

  const checkIn = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      await employeeTaskApi.checkIn(taskId, pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : undefined);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      await employeeTaskApi.checkOut(taskId, pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : undefined);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-4 w-4" />
        {openCheckIn ? `Checked in at ${new Date(openCheckIn.checkInTime!).toLocaleTimeString()}` : 'Not checked in'}
      </div>
      <button
        onClick={openCheckIn ? checkOut : checkIn}
        disabled={busy}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${openCheckIn ? 'bg-slate-700' : 'bg-emerald-600'}`}
      >
        {openCheckIn ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
        {openCheckIn ? 'Check Out' : 'Check In'}
      </button>
    </div>
  );
}
