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

export default function CheckInBar({ taskId, checkins, onChanged, locked }: { taskId: number; checkins: CheckInSummary[]; onChanged: () => void; locked?: boolean }) {
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
    <div className="flex items-center justify-between rounded-2xl border border-[#EDE6D8] bg-white p-3.5 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
      <div className="flex items-center gap-2 text-[13px] text-[#5E655D]">
        <MapPin className={`h-4 w-4 ${openCheckIn ? 'text-[#0A573B]' : 'text-[#B79A5C]'}`} />
        {openCheckIn ? `Checked in at ${new Date(openCheckIn.checkInTime!).toLocaleTimeString()}` : 'Not checked in'}
      </div>
      {(!locked || openCheckIn) && (
        <button
          onClick={openCheckIn ? checkOut : checkIn}
          disabled={busy}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-white transition active:scale-95 disabled:opacity-50 ${openCheckIn ? 'bg-[#4B524E]' : 'bg-[#0A573B]'}`}
        >
          {openCheckIn ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
          {openCheckIn ? 'Check out' : 'Check in'}
        </button>
      )}
    </div>
  );
}
