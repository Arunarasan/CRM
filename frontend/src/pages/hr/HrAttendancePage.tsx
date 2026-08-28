/**
 * Attendance overview. Daily attendance is captured per employee (Employee portal /
 * HR Command Center); this tab is a pointer, extracted from the old Human Resources
 * "Attendance" tab when HR + Workforce merged into one module.
 */
export default function HrAttendancePage() {
  return (
    <div className="bg-white border rounded-2xl p-8 text-center text-slate-500 shadow-sm">
      Daily attendance is managed per employee via their HR Command Center.
    </div>
  );
}
