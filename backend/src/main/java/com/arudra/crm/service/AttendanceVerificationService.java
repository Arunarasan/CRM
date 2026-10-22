package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceLocation;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceLocationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * Verifies a clock-in {@link AttendanceSession} against the employee's required method and stamps the
 * result onto the session. Enforcement is SOFT: a failed check never blocks the clock-in — the session
 * is marked {@code flagged}/{@code approvalStatus = PENDING} and HR is alerted to approve or reject.
 *
 * Methods:
 *   GEO           — the captured lat/lng must be within an active {@link AttendanceLocation} radius.
 *   OFFICE_DEVICE — a WebAuthn biometric assertion must have verified on this device ({@code biometricVerified}).
 *   ANY           — either a biometric assertion OR being inside a fence satisfies it.
 *
 * Rollout-safe: with GEO and no active fences configured yet, there is nothing to enforce, so the
 * session is treated as verified rather than flagging everyone.
 */
@Service
public class AttendanceVerificationService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceVerificationService.class);

    @Autowired private AttendanceLocationRepository locationRepository;
    @Autowired private NotificationService notificationService;

    private static final double EARTH_RADIUS_M = 6_371_000d;
    /** Cap on how much GPS-reported accuracy can widen the fence, so a wildly imprecise fix can't
     *  let someone pass from anywhere. */
    @Value("${app.attendance.max-accuracy-margin-meters:300}") private int maxAccuracyMargin;
    /** A flat grace band added on top of the radius + GPS accuracy, to absorb rounding and small drift
     *  so someone standing at the office isn't flagged over a few metres. */
    @Value("${app.attendance.geo-grace-meters:30}") private int geoGraceMeters;
    /** Beyond this reported accuracy, a fix is IP/Wi‑Fi-grade (not GPS) and cannot confirm whether the
     *  person is inside the fence — it's treated as "location unverifiable", never as inside/outside. */
    @Value("${app.attendance.usable-accuracy-meters:200}") private int usableAccuracyMeters;

    /** Nearest active fence to a point, with distance and whether the point is inside its radius. */
    private record GeoMatch(AttendanceLocation location, int distanceMeters, boolean inside) {}

    /**
     * Runs the check for the employee's method and mutates the session's verification fields
     * ({@code verificationMethod / verified / flagged / flagReason / distanceMeters / officeLocation /
     * approvalStatus}). Alerts admins when the session ends up flagged. Caller persists the session.
     */
    public void verify(AttendanceSession session, Employee employee, boolean biometricVerified) {
        String method = employee.getAttendanceMethod() == null ? "GEO" : employee.getAttendanceMethod();

        boolean hasCoords = session.getCheckInLat() != null && session.getCheckInLng() != null;
        List<AttendanceLocation> fences = locationRepository.findByActiveTrueAndIsDeletedFalse();
        int accuracyMargin = Math.min(maxAccuracyMargin,
                Math.max(0, session.getAccuracyMeters() == null ? 0 : session.getAccuracyMeters()));
        int tolerance = accuracyMargin + Math.max(0, geoGraceMeters); // extra allowance on top of the radius
        GeoMatch geo = (hasCoords && !fences.isEmpty())
                ? nearest(session.getCheckInLat(), session.getCheckInLng(), fences, tolerance) : null;
        stampGeo(session, geo); // record distance/nearest fence for the audit trail regardless of method

        // A fix whose accuracy is worse than a usable bound is IP/Wi‑Fi-grade, not GPS: its position
        // (and any distance we compute from it) is meaningless, so it can neither confirm nor deny the
        // fence. Treat it as "unverifiable" rather than trusting it in either direction.
        Integer acc = session.getAccuracyMeters();
        boolean coarse = acc != null && acc > usableAccuracyMeters;
        boolean geoInside = geo != null && !coarse && geo.inside();

        if (geo != null) {
            log.info("Attendance geo-check: employee={} method={} punch=({},{}) accuracy={}m nearest='{}' center=({},{}) "
                    + "distance={}m radius={}m tolerance={}m -> {}",
                    employee.getId(), method, session.getCheckInLat(), session.getCheckInLng(), session.getAccuracyMeters(),
                    geo.location().getName(), geo.location().getLatitude(), geo.location().getLongitude(),
                    geo.distanceMeters(), geo.location().getRadiusMeters(), tolerance, geo.inside() ? "INSIDE" : "OUTSIDE");
        } else if (hasCoords) {
            log.info("Attendance geo-check: employee={} method={} has coords but no active office fence configured.", employee.getId(), method);
        }

        boolean verified;
        String verificationMethod;
        String reason = null;

        switch (method) {
            case "OFFICE_DEVICE" -> {
                verificationMethod = "BIOMETRIC";
                verified = biometricVerified;
                if (!verified) reason = "Biometric identity not verified on this device.";
            }
            case "ANY" -> {
                if (biometricVerified) {
                    verified = true;
                    verificationMethod = "BIOMETRIC";
                } else if (geoInside) {
                    verified = true;
                    verificationMethod = "GEO";
                } else {
                    verified = false;
                    verificationMethod = geo != null ? "GEO" : "NONE";
                    reason = coarse ? coarseReason(acc)
                            : geo != null ? geoReason(geo, acc)
                            : "Not on an approved device and no location captured.";
                }
            }
            default -> { // GEO
                if (fences.isEmpty()) { // nothing configured to enforce yet
                    verified = true;
                    verificationMethod = "NONE";
                } else if (!hasCoords) {
                    verified = false;
                    verificationMethod = "GEO";
                    reason = "Location not captured — enable location access and clock in again.";
                } else if (coarse) {
                    verified = false; // ±acc too large to trust — don't claim a distance from it
                    verificationMethod = "GEO";
                    reason = coarseReason(acc);
                } else {
                    verified = geoInside;
                    verificationMethod = "GEO";
                    if (!verified) reason = geoReason(geo, acc);
                }
            }
        }

        session.setVerificationMethod(verificationMethod);
        session.setVerified(verified);
        session.setFlagged(!verified);
        session.setFlagReason(verified ? null : reason);
        session.setApprovalStatus(verified ? null : "PENDING");

        if (!verified) notifyFlagged(employee, reason);
    }

    /**
     * Checks the clock-out location against the office fences. Same SOFT rule as clock-in: being outside
     * (or an untrustworthy network fix) never blocks the clock-out, it flags the session for HR approval.
     * Biometric-only employees and setups with no fence configured have nothing to enforce.
     */
    public void verifyCheckOut(AttendanceSession session, Employee employee) {
        String method = employee.getAttendanceMethod() == null ? "GEO" : employee.getAttendanceMethod();
        if ("OFFICE_DEVICE".equals(method)) return;
        if (session.getCheckOutLat() == null || session.getCheckOutLng() == null) return;
        List<AttendanceLocation> fences = locationRepository.findByActiveTrueAndIsDeletedFalse();
        if (fences.isEmpty()) return;

        Integer acc = session.getCheckOutAccuracy();
        int margin = Math.min(maxAccuracyMargin, Math.max(0, acc == null ? 0 : acc));
        GeoMatch geo = nearest(session.getCheckOutLat(), session.getCheckOutLng(), fences, margin + Math.max(0, geoGraceMeters));
        boolean coarse = acc != null && acc > usableAccuracyMeters;
        if (geo == null || (!coarse && geo.inside())) return;

        String reason = "Clock-out: " + (coarse ? coarseReason(acc) : geoReason(geo, acc));
        boolean alreadyWaiting = session.isAwaitingApproval();
        session.setVerified(false);
        session.setFlagged(true);
        session.setApprovalStatus("PENDING");
        String prior = session.getFlagReason();
        session.setFlagReason(clip(prior == null || prior.isBlank() ? reason : prior + " · " + reason, 255));
        if (!alreadyWaiting) notifyFlagged(employee, reason);
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    /**
     * Kiosk punch result (method FACE or FINGER). A confident match leaves the session verified; a weak
     * one flags it for HR approval (never blocks the punch). Works for both the check-in and the
     * check-out half: a flag from either half keeps the whole session waiting.
     */
    public void applyBiometric(AttendanceSession session, Employee employee, String method, boolean weakMatch, String reason, boolean isCheckIn) {
        if (isCheckIn) {
            session.setVerificationMethod(method);
            session.setVerified(!weakMatch);
            session.setFlagged(weakMatch);
            session.setFlagReason(weakMatch ? clip(reason, 255) : null);
            session.setApprovalStatus(weakMatch ? "PENDING" : null);
            if (weakMatch) notifyFlagged(employee, reason);
            return;
        }
        if (!weakMatch) return; // a clean check-out does not clear an earlier flag
        boolean alreadyWaiting = session.isAwaitingApproval();
        session.setVerified(false);
        session.setFlagged(true);
        session.setApprovalStatus("PENDING");
        String prior = session.getFlagReason();
        session.setFlagReason(clip(prior == null || prior.isBlank() ? reason : prior + " · " + reason, 255));
        if (!alreadyWaiting) notifyFlagged(employee, reason);
    }

    // --- helpers -----------------------------------------------------------

    private void stampGeo(AttendanceSession session, GeoMatch geo) {
        if (geo == null) return;
        session.setDistanceMeters(geo.distanceMeters());
        session.setOfficeLocation(geo.location());
    }

    private GeoMatch nearest(BigDecimal lat, BigDecimal lng, List<AttendanceLocation> fences, int tolerance) {
        double plat = lat.doubleValue(), plng = lng.doubleValue();
        AttendanceLocation best = null;
        double bestDist = Double.MAX_VALUE;
        for (AttendanceLocation f : fences) {
            double d = haversineMeters(plat, plng, f.getLatitude().doubleValue(), f.getLongitude().doubleValue());
            if (d < bestDist) { bestDist = d; best = f; }
        }
        if (best == null) return null;
        int meters = (int) Math.round(bestDist);
        // Forgive GPS drift: inside when the distance falls within the radius plus the tolerance
        // (device-reported accuracy + a flat grace band).
        boolean inside = meters <= best.getRadiusMeters() + tolerance;
        return new GeoMatch(best, meters, inside);
    }

    private static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static String geoReason(GeoMatch geo, Integer accuracyMeters) {
        String gps = accuracyMeters != null ? "; GPS ±" + accuracyMeters + " m" : "";
        return "Outside office geofence — " + geo.distanceMeters() + " m from "
                + geo.location().getName() + " (" + geo.location().getRadiusMeters() + " m allowed" + gps + ").";
    }

    /** Reason when the fix is too imprecise to trust (IP/Wi‑Fi location, not GPS). */
    private static String coarseReason(Integer accuracyMeters) {
        String acc = accuracyMeters != null ? " (±" + accuracyMeters + " m)" : "";
        return "Couldn't verify your location" + acc + " — that's a network location, not GPS. "
                + "Turn on precise location and clock in from a phone, outdoors.";
    }

    private void notifyFlagged(Employee employee, String reason) {
        String name = (nz(employee.getFirstName()) + " " + nz(employee.getLastName())).trim();
        if (name.isBlank()) name = "An employee";
        notificationService.dispatchToAdmins(
                "Attendance needs approval",
                name + "'s attendance check failed: " + reason,
                "ATTENDANCE", "/hr", null);
    }

    private static String nz(String s) { return s == null ? "" : s; }
}
