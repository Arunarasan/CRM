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
                } else if (geo != null && geo.inside()) {
                    verified = true;
                    verificationMethod = "GEO";
                } else {
                    verified = false;
                    verificationMethod = geo != null ? "GEO" : "NONE";
                    reason = geo != null ? geoReason(geo, session.getAccuracyMeters()) : "Not on an approved device and no location captured.";
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
                } else {
                    verified = geo.inside();
                    verificationMethod = "GEO";
                    if (!verified) reason = geoReason(geo, session.getAccuracyMeters());
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

    private void notifyFlagged(Employee employee, String reason) {
        String name = (nz(employee.getFirstName()) + " " + nz(employee.getLastName())).trim();
        if (name.isBlank()) name = "An employee";
        notificationService.dispatchToAdmins(
                "Attendance needs approval",
                name + " clocked in but the check failed: " + reason,
                "ATTENDANCE", "/hr", null);
    }

    private static String nz(String s) { return s == null ? "" : s; }
}
