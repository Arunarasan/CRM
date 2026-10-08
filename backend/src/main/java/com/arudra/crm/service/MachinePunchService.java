package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceMachine;
import com.arudra.crm.entity.AttendanceMachineRequest;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.MachinePunch;
import com.arudra.crm.repository.AttendanceMachineRepository;
import com.arudra.crm.repository.AttendanceMachineRequestRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.MachinePunchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Receiving side of the fingerprint machine (ADMS push): decides whether a request comes from a
 * registered machine, keeps its heartbeat, and stores raw punches exactly once.
 *
 * Deliberately not one big transaction: each punch is saved on its own so a duplicate (the machine
 * re-sending a log it thinks wasn't acknowledged) is skipped without rolling back the rest.
 * New punches are then handed to {@link MachineAttendanceEngine} to become attendance sessions.
 */
@Service
public class MachinePunchService {

    private static final Logger log = LoggerFactory.getLogger(MachinePunchService.class);
    /** Heartbeats arrive every few seconds; only persist last-seen this often. */
    private static final Duration HEARTBEAT_WRITE_EVERY = Duration.ofSeconds(30);

    public enum Access { OK, UNKNOWN, INACTIVE, WRONG_IP }

    public record Gate(Access access, AttendanceMachine machine) {
        public boolean ok() { return access == Access.OK; }
    }

    public record IngestResult(int received, int saved, int duplicates, int unmatched, int skippedLines) {}

    private final AttendanceMachineRepository machineRepository;
    private final AttendanceMachineRequestRepository requestRepository;
    private final MachinePunchRepository punchRepository;
    private final EmployeeRepository employeeRepository;
    private final MachineAttendanceEngine engine;

    public MachinePunchService(AttendanceMachineRepository machineRepository,
                               AttendanceMachineRequestRepository requestRepository,
                               MachinePunchRepository punchRepository,
                               EmployeeRepository employeeRepository,
                               MachineAttendanceEngine engine) {
        this.machineRepository = machineRepository;
        this.requestRepository = requestRepository;
        this.punchRepository = punchRepository;
        this.employeeRepository = employeeRepository;
        this.engine = engine;
    }

    /**
     * Admits a request by serial number. Unknown machines are recorded for HR to add; inactive ones
     * and requests from the wrong IP (when an IP lock is set) are refused. Updates the heartbeat.
     */
    public Gate admit(String serialNumber, String ip, String pushVersion) {
        String sn = serialNumber == null ? "" : serialNumber.trim();
        if (sn.isEmpty() || sn.length() > 64) return new Gate(Access.UNKNOWN, null);

        Optional<AttendanceMachine> found = machineRepository.findBySerialNumberAndIsDeletedFalse(sn);
        if (found.isEmpty()) {
            recordUnknown(sn, ip, pushVersion);
            return new Gate(Access.UNKNOWN, null);
        }
        AttendanceMachine m = found.get();
        if (!Boolean.TRUE.equals(m.getActive())) return new Gate(Access.INACTIVE, m);
        if (m.getAllowedIp() != null && !m.getAllowedIp().isBlank() && !m.getAllowedIp().trim().equals(ip)) {
            log.warn("Fingerprint machine {} refused: request from {} but locked to {}", sn, ip, m.getAllowedIp());
            return new Gate(Access.WRONG_IP, m);
        }
        return new Gate(Access.OK, heartbeat(m, ip, pushVersion));
    }

    /** Returns the machine as saved (fresh version), so later saves in the same request don't conflict. */
    private AttendanceMachine heartbeat(AttendanceMachine m, String ip, String pushVersion) {
        LocalDateTime now = LocalDateTime.now();
        boolean stale = m.getLastSeenAt() == null || Duration.between(m.getLastSeenAt(), now).compareTo(HEARTBEAT_WRITE_EVERY) >= 0;
        boolean changed = (ip != null && !ip.equals(m.getLastIp()))
                || (pushVersion != null && !pushVersion.isBlank() && !pushVersion.equals(m.getPushVersion()));
        if (!stale && !changed && !Boolean.TRUE.equals(m.getOfflineAlerted())) return m;
        m.setLastSeenAt(now);
        if (ip != null) m.setLastIp(clip(ip, 64));
        if (pushVersion != null && !pushVersion.isBlank()) m.setPushVersion(clip(pushVersion, 30));
        m.setOfflineAlerted(false); // back online; the offline monitor may alert again later
        return machineRepository.save(m);
    }

    private void recordUnknown(String sn, String ip, String pushVersion) {
        try {
            LocalDateTime now = LocalDateTime.now();
            AttendanceMachineRequest r = requestRepository.findBySerialNumber(sn).orElse(null);
            if (r == null) {
                r = new AttendanceMachineRequest();
                r.setSerialNumber(sn);
                r.setFirstSeenAt(now);
                r.setAttempts(0);
                log.info("Unknown fingerprint machine {} tried to connect from {}", sn, ip);
            } else if (r.getLastSeenAt() != null && Duration.between(r.getLastSeenAt(), now).compareTo(HEARTBEAT_WRITE_EVERY) < 0) {
                return; // it polls every few seconds; don't write on every poll
            }
            r.setAttempts(r.getAttempts() + 1);
            r.setLastSeenAt(now);
            r.setLastIp(clip(ip, 64));
            if (pushVersion != null && !pushVersion.isBlank()) r.setPushVersion(clip(pushVersion, 30));
            requestRepository.save(r);
        } catch (DataIntegrityViolationException e) {
            // two polls raced to create the same row — harmless
        }
    }

    /** Stores an ATTLOG upload. Returns counts; the machine is told how many lines were handled. */
    public IngestResult ingestAttLog(AttendanceMachine machine, String body) {
        AdmsParser.Result parsed = AdmsParser.parseAttLog(body);
        int saved = 0, dups = 0, unmatched = 0;
        Map<String, Employee> byPin = new HashMap<>();
        Map<Long, Set<LocalDate>> touched = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime latest = machine.getLastPunchAt();
        // On first contact a machine uploads its whole stored history: anything from before the day it
        // was added to the CRM (or dated in the future, i.e. a wrong machine clock) is kept but never used.
        LocalDate firstUsableDay = machine.getCreatedAt() == null ? null : machine.getCreatedAt().toLocalDate();

        for (AdmsParser.Punch p : parsed.punches()) {
            if (punchRepository.existsByMachineIdAndMachinePinAndPunchTime(machine.getId(), p.pin(), p.time())) {
                dups++;
                continue;
            }
            Employee emp = byPin.computeIfAbsent(p.pin(),
                    pin -> employeeRepository.findByMachinePinAndIsDeletedFalse(pin).orElse(null));
            MachinePunch mp = new MachinePunch();
            mp.setMachine(machine);
            mp.setMachinePin(p.pin());
            mp.setPunchTime(p.time());
            mp.setEmployee(emp);
            mp.setStatusCode(p.status());
            mp.setVerifyCode(p.verify());
            mp.setWorkCode(p.workCode());
            mp.setRawLine(p.rawLine());
            mp.setReceivedAt(now);
            LocalDateTime serverTime = MachineAttendanceEngine.toServerTime(p.time(), machine.getTimeZone());
            boolean outOfRange = (firstUsableDay != null && serverTime.toLocalDate().isBefore(firstUsableDay))
                    || serverTime.isAfter(now.plusDays(1));
            mp.setResult(outOfRange ? MachinePunch.OUT_OF_RANGE : emp == null ? MachinePunch.UNMATCHED : MachinePunch.PENDING);
            try {
                punchRepository.save(mp);
                saved++;
                if (emp == null) unmatched++;
                if (latest == null || p.time().isAfter(latest)) latest = p.time();
                if (emp != null && !outOfRange) {
                    touched.computeIfAbsent(emp.getId(), k -> new HashSet<>()).add(serverTime.toLocalDate());
                }
            } catch (DataIntegrityViolationException e) {
                dups++; // raced with a resend of the same line
            }
        }
        if (saved > 0) {
            machine.setLastPunchAt(latest);
            machineRepository.save(machine);
        }
        // Turn the new punches into attendance, one employee at a time. A failure for one employee
        // never loses anyone's punches: they're already stored and can be reprocessed.
        for (Map.Entry<Long, Set<LocalDate>> e : touched.entrySet()) {
            try {
                engine.rebuild(e.getKey(), e.getValue());
            } catch (Exception ex) {
                log.error("Could not build machine attendance for employee {} on {}: {}", e.getKey(), e.getValue(), ex.getMessage(), ex);
            }
        }
        if (parsed.skippedLines() > 0) {
            log.warn("Fingerprint machine {}: skipped {} unreadable ATTLOG line(s)", machine.getSerialNumber(), parsed.skippedLines());
        }
        log.info("Fingerprint machine {}: {} punch line(s) — {} new, {} duplicate, {} unmatched",
                machine.getSerialNumber(), parsed.punches().size(), saved, dups, unmatched);
        return new IngestResult(parsed.punches().size() + parsed.skippedLines(), saved, dups, unmatched, parsed.skippedLines());
    }

    private static String clip(String s, int max) {
        return s == null ? null : (s.length() <= max ? s : s.substring(0, max));
    }
}
