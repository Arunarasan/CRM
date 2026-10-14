package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeFaceTemplate;
import com.arudra.crm.repository.EmployeeFaceTemplateRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Face enrollment for kiosk attendance. The browser turns a camera frame into a 128-number
 * descriptor (face-api); this service validates and stores a few of them per employee. Matching is
 * by Euclidean distance: ~0.6 is the library's "same person" limit, genuine pairs sit around
 * 0.2-0.45. Enrollment is refused when the samples disagree with each other (two people in front of
 * the camera) or when the face is too close to a different employee's (a twin or a double enrolment).
 */
@Service
public class FaceTemplateService {

    static final int DESCRIPTOR_SIZE = 128;
    static final int MIN_SAMPLES = 3;
    static final int MAX_SAMPLES = 8;
    /** Samples of one person must agree at least this well. */
    static final double SELF_CONSISTENCY_MAX = 0.55;
    /** A face closer than this to another employee's template is treated as the same person. */
    static final double OTHER_EMPLOYEE_MIN = 0.45;

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired private EmployeeFaceTemplateRepository templateRepository;
    @Autowired private EmployeeRepository employeeRepository;

    // --- queries -----------------------------------------------------------

    public Map<String, Object> status(Long employeeId) {
        requireEmployee(employeeId);
        List<EmployeeFaceTemplate> rows = templateRepository.findByEmployeeIdOrderBySampleNoAsc(employeeId);
        return statusOf(rows);
    }

    /** Enrolled employees only: employeeId -> {samples, enrolledAt}. */
    public Map<Long, Map<String, Object>> summary() {
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        for (Object[] r : templateRepository.summary()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("samples", ((Number) r[1]).intValue());
            m.put("enrolledAt", r[2]);
            out.put(((Number) r[0]).longValue(), m);
        }
        return out;
    }

    // --- enroll / remove ---------------------------------------------------

    /** Replaces the employee's face templates with the given samples. */
    @Transactional
    public Map<String, Object> enroll(Long employeeId, List<List<Double>> descriptors, List<Double> qualities,
                                      String photoUrl, String enrolledBy) {
        Employee employee = requireEmployee(employeeId);
        if (descriptors == null || descriptors.size() < MIN_SAMPLES || descriptors.size() > MAX_SAMPLES) {
            throw new IllegalArgumentException("Capture " + MIN_SAMPLES + " to " + MAX_SAMPLES + " face samples.");
        }
        double[][] vecs = new double[descriptors.size()][];
        for (int i = 0; i < vecs.length; i++) vecs[i] = validated(descriptors.get(i));

        // The samples must all be the same face.
        for (int i = 0; i < vecs.length; i++) {
            for (int j = i + 1; j < vecs.length; j++) {
                if (distance(vecs[i], vecs[j]) > SELF_CONSISTENCY_MAX) {
                    throw new IllegalArgumentException(
                            "The captured faces do not match each other. Make sure only one person is in front of the camera and try again.");
                }
            }
        }

        // It must not be a face that already belongs to someone else.
        for (EmployeeFaceTemplate other : templateRepository.findAllExcept(employeeId)) {
            double[] ov = parse(other.getDescriptor());
            if (ov == null) continue;
            for (double[] v : vecs) {
                if (distance(v, ov) < OTHER_EMPLOYEE_MIN) {
                    Employee o = other.getEmployee();
                    String who = (nz(o.getFirstName()) + " " + nz(o.getLastName())).trim();
                    throw new IllegalArgumentException("This face looks like " + (who.isEmpty() ? "another employee" : who)
                            + ", who is already enrolled. Check you picked the right employee.");
                }
            }
        }

        templateRepository.deleteAllForEmployee(employeeId);
        templateRepository.flush();
        List<EmployeeFaceTemplate> saved = new ArrayList<>();
        for (int i = 0; i < vecs.length; i++) {
            EmployeeFaceTemplate t = new EmployeeFaceTemplate();
            t.setEmployee(employee);
            t.setSampleNo(i + 1);
            t.setDescriptor(toJson(vecs[i]));
            t.setQuality(qualities != null && i < qualities.size() ? qualities.get(i) : null);
            t.setPhotoUrl(i == 0 ? photoUrl : null);
            t.setEnrolledBy(enrolledBy);
            saved.add(templateRepository.save(t));
        }
        return statusOf(saved);
    }

    @Transactional
    public void remove(Long employeeId) {
        requireEmployee(employeeId);
        templateRepository.deleteAllForEmployee(employeeId);
    }

    // --- helpers -----------------------------------------------------------

    private Map<String, Object> statusOf(List<EmployeeFaceTemplate> rows) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enrolled", !rows.isEmpty());
        m.put("samples", rows.size());
        m.put("enrolledAt", rows.stream().map(EmployeeFaceTemplate::getCreatedAt).filter(d -> d != null)
                .max(LocalDateTime::compareTo).orElse(null));
        m.put("photoUrl", rows.stream().map(EmployeeFaceTemplate::getPhotoUrl).filter(u -> u != null).findFirst().orElse(null));
        m.put("enrolledBy", rows.isEmpty() ? null : rows.get(0).getEnrolledBy());
        return m;
    }

    private Employee requireEmployee(Long id) {
        return employeeRepository.findById(id).filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
    }

    private static double[] validated(List<Double> list) {
        if (list == null || list.size() != DESCRIPTOR_SIZE) {
            throw new IllegalArgumentException("Invalid face sample. Please capture again.");
        }
        double[] v = new double[DESCRIPTOR_SIZE];
        for (int i = 0; i < v.length; i++) {
            Double d = list.get(i);
            if (d == null || d.isNaN() || d.isInfinite() || Math.abs(d) > 10) {
                throw new IllegalArgumentException("Invalid face sample. Please capture again.");
            }
            v[i] = d;
        }
        return v;
    }

    static double distance(double[] a, double[] b) {
        double s = 0;
        for (int i = 0; i < a.length; i++) {
            double d = a[i] - b[i];
            s += d * d;
        }
        return Math.sqrt(s);
    }

    private String toJson(double[] v) {
        try {
            return mapper.writeValueAsString(v);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private double[] parse(String json) {
        try {
            double[] v = mapper.readValue(json, double[].class);
            return v.length == DESCRIPTOR_SIZE ? v : null;
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
