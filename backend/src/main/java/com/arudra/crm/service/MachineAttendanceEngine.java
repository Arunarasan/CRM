package com.arudra.crm.service;

import com.arudra.crm.config.MachineAttendanceSettings;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.AttendanceCorrectionRequestRepository;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.MachinePunchRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * Turns fingerprint-machine punches into attendance sessions, using {@link MachinePairingPlanner} for
 * the rules. Rebuilds whole days so punches that arrive late or out of order (machine was offline)
 * always end in the same result.
 *
 * What a rebuild never touches:
 * <ul>
 *   <li>Phone (portal) sessions, and a machine clock-in that was closed from the phone.</li>
 *   <li>A day HR has corrected, has a correction request on, or already approved/rejected a machine
 *       session for — new punches there are kept as AFTER_CORRECTION for HR to see.</li>
 * </ul>
 */
@Service
public class MachineAttendanceEngine {

    private static final Logger log = LoggerFactory.getLogger(MachineAttendanceEngine.class);
    static final String MISSING_OUT_REASON = "Missing clock-out on the fingerprint machine — add the time with a correction.";

    private final MachinePunchRepository punchRepository;
    private final AttendanceRepository attendanceRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceCorrectionRequestRepository correctionRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeTimeService timeService;
    private final MachineAttendanceSettings settings;
    private final EntityManager entityManager;

    public MachineAttendanceEngine(MachinePunchRepository punchRepository, AttendanceRepository attendanceRepository,
                                   AttendanceSessionRepository sessionRepository,
                                   AttendanceCorrectionRequestRepository correctionRepository,
                                   EmployeeRepository employeeRepository, EmployeeTimeService timeService,
                                   MachineAttendanceSettings settings, EntityManager entityManager) {
        this.punchRepository = punchRepository;
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.correctionRepository = correctionRepository;
        this.employeeRepository = employeeRepository;
        this.timeService = timeService;
        this.settings = settings;
        this.entityManager = entityManager;
    }

    /** Machine-local wall time → server-local wall time (the zone attendance is recorded in). */
    public static LocalDateTime toServerTime(LocalDateTime machineTime, String machineZone) {
        ZoneId from;
        try {
            from = ZoneId.of(machineZone == null || machineZone.isBlank() ? "Asia/Kolkata" : machineZone);
        } catch (Exception e) {
            from = ZoneId.systemDefault();
        }
        return machineTime.atZone(from).withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /** Rebuilds the given days (plus a day either side, for night shifts) for one employee. */
    @Transactional
    public void rebuild(Long employeeId, Collection<LocalDate> dates) {
        if (employeeId == null || dates == null || dates.isEmpty()) return;
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee == null) return;
        LocalDate from = Collections.min(dates).minusDays(1);
        LocalDate to = Collections.max(dates).plusDays(1);
        LocalDate today = LocalDate.now();
        if (to.isAfter(today.plusDays(1))) to = today.plusDays(1);
        if (from.isAfter(to)) return;

        // 1) Punches around the range (two days of slack for night shifts and double taps at the edges).
        List<MachinePunch> loaded = punchRepository.findByEmployeeIdAndPunchTimeBetweenOrderByPunchTimeAsc(
                employeeId, from.minusDays(3).atStartOfDay(), to.plusDays(3).atStartOfDay());
        Map<Long, MachinePunch> byId = new HashMap<>();
        Map<Long, LocalDateTime> serverTime = new HashMap<>();
        for (MachinePunch mp : loaded) {
            if (MachinePunch.OUT_OF_RANGE.equals(mp.getResult()) || MachinePunch.UNMATCHED.equals(mp.getResult())) continue;
            byId.put(mp.getId(), mp);
            serverTime.put(mp.getId(), toServerTime(mp.getPunchTime(), mp.getMachine().getTimeZone()));
        }

        // 2) Which days may be rebuilt, and which sessions on them belong to the machine.
        Map<LocalDate, Attendance> attByDay = new HashMap<>();
        Map<LocalDate, List<AttendanceSession>> removable = new HashMap<>();
        Set<LocalDate> locked = new HashSet<>();
        Set<Long> frozenPunchIds = new HashSet<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, d).orElse(null);
            attByDay.put(d, att);
            List<AttendanceSession> sessions = att == null ? List.of() : sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());
            List<AttendanceSession> mine = new ArrayList<>();
            Set<Long> kept = new HashSet<>();
            boolean dayLocked = false;
            for (AttendanceSession s : sessions) {
                boolean manual = AttendanceSession.SOURCE_MANUAL.equals(s.getCheckInSource())
                        || AttendanceSession.SOURCE_MANUAL.equals(s.getCheckOutSource());
                boolean machineOnly = AttendanceSession.SOURCE_MACHINE.equals(s.getCheckInSource())
                        && (s.getCheckOutSource() == null || AttendanceSession.SOURCE_MACHINE.equals(s.getCheckOutSource()));
                boolean decided = "APPROVED".equals(s.getApprovalStatus()) || "REJECTED".equals(s.getApprovalStatus());
                if (manual || (machineOnly && decided)) dayLocked = true;
                if (machineOnly) mine.add(s);
                else kept.add(s.getId());
            }
            if (!mine.isEmpty() && correctionRepository.existsByAttendanceSessionIdIn(mine.stream().map(AttendanceSession::getId).toList())) {
                dayLocked = true;
            }
            if (dayLocked) locked.add(d);
            else removable.put(d, mine);
            // Punches tied to a session the rebuild keeps (e.g. a machine clock-in closed from the phone) stay put.
            for (MachinePunch mp : byId.values()) {
                if (mp.getSession() != null && kept.contains(mp.getSession().getId())) frozenPunchIds.add(mp.getId());
            }
        }

        // 3) Plan with everything that isn't frozen or on a locked day.
        List<MachinePairingPlanner.P> input = new ArrayList<>();
        for (MachinePunch mp : byId.values()) {
            LocalDateTime t = serverTime.get(mp.getId());
            if (frozenPunchIds.contains(mp.getId()) || locked.contains(t.toLocalDate())) continue;
            input.add(new MachinePairingPlanner.P(mp.getId(), t, mp.getStatusCode(),
                    Boolean.TRUE.equals(mp.getMachine().getUseInOutKeys())));
        }
        MachinePairingPlanner.Plan plan = MachinePairingPlanner.plan(input, from, to, today,
                settings.getDuplicateTapSeconds(), settings.getMaxShiftHours());

        // 4) Keep sessions that come out identical (same times, same flag) so their ids stay stable —
        //    HR may be looking at one in the approvals list. Only the rest are unlinked and deleted.
        Map<MachinePairingPlanner.SessionPlan, AttendanceSession> reused = new IdentityHashMap<>();
        List<AttendanceSession> toDelete = new ArrayList<>();
        for (Map.Entry<LocalDate, List<AttendanceSession>> e : removable.entrySet()) {
            List<AttendanceSession> existing = new ArrayList<>(e.getValue());
            for (MachinePairingPlanner.SessionPlan sp : plan.sessions().getOrDefault(e.getKey(), List.of())) {
                for (Iterator<AttendanceSession> it = existing.iterator(); it.hasNext(); ) {
                    AttendanceSession s = it.next();
                    if (Objects.equals(s.getCheckInTime(), sp.in()) && Objects.equals(s.getCheckOutTime(), sp.out())
                            && Boolean.TRUE.equals(s.getFlagged()) == sp.missingOut()) {
                        reused.put(sp, s);
                        it.remove();
                        break;
                    }
                }
            }
            toDelete.addAll(existing);
        }
        if (!toDelete.isEmpty()) {
            Set<Long> ids = new HashSet<>(toDelete.stream().map(AttendanceSession::getId).toList());
            for (MachinePunch mp : byId.values()) {
                if (mp.getSession() != null && ids.contains(mp.getSession().getId())) mp.setSession(null);
            }
            entityManager.flush();
            punchRepository.clearSessionLinks(ids);
            sessionRepository.deleteAll(toDelete);
            entityManager.flush();
        }

        // 5) Create the planned sessions and record what happened to each punch.
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (locked.contains(d)) {
                for (MachinePunch mp : byId.values()) {
                    if (serverTime.get(mp.getId()).toLocalDate().equals(d) && mp.getSession() == null) {
                        mp.setResult(MachinePunch.AFTER_CORRECTION);
                    }
                }
                continue;
            }
            List<MachinePairingPlanner.SessionPlan> planned = plan.sessions().getOrDefault(d, List.of());
            Attendance att = attByDay.get(d);
            if (att == null && !planned.isEmpty()) {
                att = new Attendance();
                att.setEmployee(employee);
                att.setDate(d);
                att.setStatus("PRESENT");
                att = attendanceRepository.save(att);
            }
            for (MachinePairingPlanner.SessionPlan sp : planned) {
                // save() merges (BaseEntity starts at version 0, so it's never "new"): link the returned copy.
                AttendanceSession s = reused.containsKey(sp) ? reused.get(sp) : sessionRepository.save(newSession(att, sp, byId));
                MachinePunch in = byId.get(sp.inPunch().id());
                if (!sp.fromPreviousDay() && in != null) in.setSession(s);
                if (sp.outPunch() != null && !sp.toNextDay()) {
                    MachinePunch out = byId.get(sp.outPunch().id());
                    if (out != null) out.setSession(s);
                }
            }
            // Results for this day's punches (a carried night-shift out is dated today, so it's included).
            for (MachinePunch mp : byId.values()) {
                if (!serverTime.get(mp.getId()).toLocalDate().equals(d) || frozenPunchIds.contains(mp.getId())) continue;
                MachinePairingPlanner.Outcome o = plan.outcomes().get(mp.getId());
                mp.setResult(o == null ? MachinePunch.PENDING : switch (o) {
                    case USED -> MachinePunch.USED;
                    case DUPLICATE_TAP -> MachinePunch.DUPLICATE_TAP;
                    case IGNORED -> MachinePunch.IGNORED;
                });
                if (o != MachinePairingPlanner.Outcome.USED) mp.setSession(null);
            }
            if (att != null) {
                if (!planned.isEmpty()) att.setStatus("PRESENT");
                timeService.recomputeAggregate(att);
            }
        }
        punchRepository.saveAll(byId.values());
        log.info("Machine attendance rebuilt for employee {} {}..{} ({} punches, {} locked day(s))",
                employeeId, from, to, input.size(), locked.size());
    }

    /** Rebuild every day in a range (HR "reprocess" tool), capped at ~2 months. */
    @Transactional
    public void rebuildRange(Long employeeId, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) throw new IllegalArgumentException("Pick a valid date range.");
        if (from.plusDays(62).isBefore(to)) throw new IllegalArgumentException("Reprocess at most 2 months at a time.");
        List<LocalDate> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) days.add(d);
        rebuild(employeeId, days);
    }

    private AttendanceSession newSession(Attendance att, MachinePairingPlanner.SessionPlan sp, Map<Long, MachinePunch> byId) {
        MachinePunch in = byId.get(sp.inPunch().id());
        AttendanceMachine machine = in != null ? in.getMachine() : null;
        AttendanceSession s = new AttendanceSession();
        s.setAttendance(att);
        s.setCheckInTime(sp.in());
        s.setCheckOutTime(sp.out());
        s.setCheckInSource(AttendanceSession.SOURCE_MACHINE);
        s.setCheckOutSource(sp.out() == null ? null : AttendanceSession.SOURCE_MACHINE);
        s.setMachine(machine);
        s.setOfficeLocation(machine == null ? null : machine.getOfficeLocation());
        s.setDeviceInfo(machine == null ? "Fingerprint machine" : "Fingerprint machine · " + machine.getName());
        s.setVerificationMethod("MACHINE");
        s.setVerified(!sp.missingOut());
        s.setFlagged(sp.missingOut());
        s.setFlagReason(sp.missingOut() ? MISSING_OUT_REASON : null);
        s.setApprovalStatus(sp.missingOut() ? "PENDING" : null);
        return s;
    }
}
