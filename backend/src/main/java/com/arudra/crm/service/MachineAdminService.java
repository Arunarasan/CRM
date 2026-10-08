package com.arudra.crm.service;

import com.arudra.crm.config.MachineAttendanceSettings;
import com.arudra.crm.entity.AttendanceMachine;
import com.arudra.crm.entity.AttendanceMachineRequest;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.MachinePunch;
import com.arudra.crm.repository.AttendanceLocationRepository;
import com.arudra.crm.repository.AttendanceMachineRepository;
import com.arudra.crm.repository.AttendanceMachineRequestRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.MachinePunchRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Pattern;

/**
 * HR management of office fingerprint machines: register / edit / deactivate machines, see unknown
 * machines trying to connect, link unmatched machine IDs to employees, and browse the punch log.
 */
@Service
public class MachineAdminService {

    private static final Pattern SN = Pattern.compile("^[A-Za-z0-9_-]{3,64}$");
    private static final Pattern PIN = Pattern.compile("^[0-9]{1,20}$");

    private final AttendanceMachineRepository machineRepository;
    private final AttendanceMachineRequestRepository requestRepository;
    private final MachinePunchRepository punchRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceLocationRepository locationRepository;
    private final MachineAttendanceSettings settings;
    private final MachineAttendanceEngine engine;

    public MachineAdminService(AttendanceMachineRepository machineRepository,
                               AttendanceMachineRequestRepository requestRepository,
                               MachinePunchRepository punchRepository, EmployeeRepository employeeRepository,
                               AttendanceLocationRepository locationRepository, MachineAttendanceSettings settings,
                               MachineAttendanceEngine engine) {
        this.machineRepository = machineRepository;
        this.requestRepository = requestRepository;
        this.punchRepository = punchRepository;
        this.employeeRepository = employeeRepository;
        this.locationRepository = locationRepository;
        this.settings = settings;
        this.engine = engine;
    }

    // --- machines -------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listMachines() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        return machineRepository.findByIsDeletedFalseOrderByNameAsc().stream().map(m -> {
            Map<String, Object> v = view(m);
            v.put("punchesToday", punchRepository.countByMachineIdAndPunchTimeAfter(m.getId(), startOfDay));
            return v;
        }).toList();
    }

    public record MachineInput(String serialNumber, String name, Long officeLocationId, String timeZone,
                               Boolean active, Boolean useInOutKeys, String allowedIp, String model) {}

    @Transactional
    public Map<String, Object> saveMachine(Long id, MachineInput in) {
        AttendanceMachine m = id == null ? new AttendanceMachine()
                : machineRepository.findById(id).filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                    .orElseThrow(() -> new IllegalArgumentException("Machine not found."));
        String sn = in.serialNumber() == null ? null : in.serialNumber().trim();
        if (sn == null || !SN.matcher(sn).matches()) {
            throw new IllegalArgumentException("Enter the machine's serial number (letters and digits, as shown on the machine).");
        }
        machineRepository.findBySerialNumberAndIsDeletedFalse(sn).ifPresent(other -> {
            if (!other.getId().equals(m.getId())) throw new IllegalArgumentException("A machine with this serial number is already added.");
        });
        if (in.name() == null || in.name().isBlank()) throw new IllegalArgumentException("Give the machine a name.");
        String tz = in.timeZone() == null || in.timeZone().isBlank() ? "Asia/Kolkata" : in.timeZone().trim();
        try {
            ZoneId.of(tz);
        } catch (Exception e) {
            throw new IllegalArgumentException("Unknown time zone: " + tz);
        }
        m.setSerialNumber(sn);
        m.setName(in.name().trim());
        m.setTimeZone(tz);
        m.setOfficeLocation(in.officeLocationId() == null ? null
                : locationRepository.findById(in.officeLocationId()).orElseThrow(() -> new IllegalArgumentException("Office location not found.")));
        if (in.active() != null) m.setActive(in.active());
        if (in.useInOutKeys() != null) m.setUseInOutKeys(in.useInOutKeys());
        m.setAllowedIp(in.allowedIp() == null || in.allowedIp().isBlank() ? null : in.allowedIp().trim());
        if (in.model() != null) m.setModel(in.model().isBlank() ? null : in.model().trim());
        AttendanceMachine saved = machineRepository.save(m);
        // Adding a machine that was knocking clears it from the "trying to connect" list.
        requestRepository.findBySerialNumber(sn).ifPresent(r -> {
            r.setDismissed(true);
            requestRepository.save(r);
        });
        return view(saved);
    }

    /** Soft-removes a machine; its punch history stays. */
    @Transactional
    public void deleteMachine(Long id, String actor) {
        AttendanceMachine m = machineRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Machine not found."));
        m.setActive(false);
        m.setIsDeleted(true);
        m.setDeletedAt(LocalDateTime.now());
        m.setDeletedBy(actor);
        machineRepository.save(m);
    }

    // --- unknown machines -------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listConnectionRequests() {
        return requestRepository.findByDismissedFalseAndIsDeletedFalseOrderByLastSeenAtDesc().stream().map(r -> {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("id", r.getId());
            v.put("serialNumber", r.getSerialNumber());
            v.put("lastIp", r.getLastIp());
            v.put("pushVersion", r.getPushVersion());
            v.put("attempts", r.getAttempts());
            v.put("firstSeenAt", r.getFirstSeenAt());
            v.put("lastSeenAt", r.getLastSeenAt());
            return v;
        }).toList();
    }

    @Transactional
    public void dismissConnectionRequest(Long id) {
        AttendanceMachineRequest r = requestRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Request not found."));
        r.setDismissed(true);
        requestRepository.save(r);
    }

    // --- machine IDs ------------------------------------------------------------

    /** Machine IDs that punched but aren't linked to an employee yet. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listUnmatchedPins() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : punchRepository.summarizeUnmatched()) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("machinePin", row[0]);
            v.put("punches", row[1]);
            v.put("firstPunchAt", row[2]);
            v.put("lastPunchAt", row[3]);
            out.add(v);
        }
        return out;
    }

    /**
     * Sets (or clears, when blank) an employee's machine ID and links any punches already received
     * under that ID and turns them into attendance. Returns how many earlier punches were linked.
     */
    @Transactional
    public Map<String, Object> setEmployeePin(Long employeeId, String pin) {
        Employee e = employeeRepository.findById(employeeId).orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        String p = pin == null ? "" : pin.trim();
        if (p.isEmpty()) {
            e.setMachinePin(null);
            employeeRepository.save(e);
            return Map.of("employeeId", e.getId(), "machinePin", "", "linkedPunches", 0);
        }
        if (!PIN.matcher(p).matches()) throw new IllegalArgumentException("Machine ID must be digits only.");
        employeeRepository.findByMachinePinAndIsDeletedFalse(p).ifPresent(other -> {
            if (!other.getId().equals(e.getId())) {
                throw new IllegalArgumentException("Machine ID " + p + " is already used by "
                        + (nz(other.getFirstName()) + " " + nz(other.getLastName())).trim() + ".");
            }
        });
        e.setMachinePin(p);
        employeeRepository.save(e);
        int linked = 0;
        Set<LocalDate> days = new HashSet<>();
        for (MachinePunch mp : punchRepository.findByEmployeeIsNullAndMachinePinOrderByPunchTimeAsc(p)) {
            mp.setEmployee(e);
            if (MachinePunch.UNMATCHED.equals(mp.getResult())) {
                mp.setResult(MachinePunch.PENDING);
                days.add(MachineAttendanceEngine.toServerTime(mp.getPunchTime(), mp.getMachine().getTimeZone()).toLocalDate());
            }
            punchRepository.save(mp);
            linked++;
        }
        engine.rebuild(e.getId(), days); // earlier punches under this ID become attendance now
        return Map.of("employeeId", e.getId(), "machinePin", p, "linkedPunches", linked);
    }

    /** Re-runs the pairing for an employee's date range (safety tool after fixing a machine ID or time zone). */
    public void reprocess(Long employeeId, LocalDate from, LocalDate to) {
        employeeRepository.findById(employeeId).orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        engine.rebuildRange(employeeId, from, to);
    }

    // --- punch log ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchPunches(Long machineId, Long employeeId, LocalDate from, LocalDate to, int limit) {
        LocalDate f = from == null ? LocalDate.now().minusDays(7) : from;
        LocalDate t = to == null ? LocalDate.now() : to;
        int size = Math.min(Math.max(limit, 1), 1000);
        return punchRepository.search(machineId, employeeId, f.atStartOfDay(), t.plusDays(1).atStartOfDay(), PageRequest.of(0, size))
                .stream().map(p -> {
                    Map<String, Object> v = new LinkedHashMap<>();
                    v.put("id", p.getId());
                    v.put("machineId", p.getMachine().getId());
                    v.put("machineName", p.getMachine().getName());
                    v.put("machinePin", p.getMachinePin());
                    v.put("employeeId", p.getEmployee() == null ? null : p.getEmployee().getId());
                    v.put("employeeName", p.getEmployee() == null ? null
                            : (nz(p.getEmployee().getFirstName()) + " " + nz(p.getEmployee().getLastName())).trim());
                    v.put("punchTime", p.getPunchTime());
                    v.put("verifyMethod", verifyLabel(p.getVerifyCode()));
                    v.put("statusCode", p.getStatusCode());
                    v.put("result", p.getResult());
                    v.put("receivedAt", p.getReceivedAt());
                    return v;
                }).toList();
    }

    // --- helpers ------------------------------------------------------------------

    private Map<String, Object> view(AttendanceMachine m) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", m.getId());
        v.put("serialNumber", m.getSerialNumber());
        v.put("name", m.getName());
        v.put("officeLocationId", m.getOfficeLocation() == null ? null : m.getOfficeLocation().getId());
        v.put("officeLocationName", m.getOfficeLocation() == null ? null : m.getOfficeLocation().getName());
        v.put("timeZone", m.getTimeZone());
        v.put("active", m.getActive());
        v.put("useInOutKeys", m.getUseInOutKeys());
        v.put("allowedIp", m.getAllowedIp());
        v.put("model", m.getModel());
        v.put("pushVersion", m.getPushVersion());
        v.put("lastSeenAt", m.getLastSeenAt());
        v.put("lastIp", m.getLastIp());
        v.put("lastPunchAt", m.getLastPunchAt());
        v.put("online", isOnline(m));
        return v;
    }

    /** Online = reported within the offline-alert window (machines poll every few seconds). */
    private boolean isOnline(AttendanceMachine m) {
        return Boolean.TRUE.equals(m.getActive()) && m.getLastSeenAt() != null
                && Duration.between(m.getLastSeenAt(), LocalDateTime.now()).toMinutes() < Math.min(5, settings.getOfflineAlertMinutes());
    }

    static String verifyLabel(Integer code) {
        if (code == null) return null;
        return switch (code) {
            case 0 -> "PASSWORD";
            case 1 -> "FINGER";
            case 2, 4 -> "CARD";
            case 15 -> "FACE";
            default -> "OTHER";
        };
    }

    private static String nz(String s) { return s == null ? "" : s; }
}
