package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeBonus;
import com.arudra.crm.entity.EmployeeReview;
import com.arudra.crm.entity.SiteSetting;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.EmployeeReviewRepository;
import com.arudra.crm.repository.SiteSettingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Personal-QR employee reviews. Two sides:
 *  - CRM/HR + employee portal: read/generate the QR token, list reviews, moderate them.
 *  - public ({@code /api/public/employee-review/{token}}): a scanned customer reads who they're
 *    reviewing and submits a rating + message, then is handed the Google review URL to go post publicly.
 */
@Service
public class EmployeeReviewService {

    private static final String GOOGLE_REVIEW_KEY = "google_review_url";
    private static final String REWARD_AMOUNT_KEY = "google_review_reward_amount";

    private final EmployeeRepository employeeRepository;
    private final EmployeeReviewRepository reviewRepository;
    private final SiteSettingRepository settingRepository;
    private final PayrollService payrollService;

    public EmployeeReviewService(EmployeeRepository employeeRepository,
                                 EmployeeReviewRepository reviewRepository,
                                 SiteSettingRepository settingRepository,
                                 PayrollService payrollService) {
        this.employeeRepository = employeeRepository;
        this.reviewRepository = reviewRepository;
        this.settingRepository = settingRepository;
        this.payrollService = payrollService;
    }

    // =====================================================================
    // QR token
    // =====================================================================

    /** Returns the employee's review token, generating (and persisting) one if it doesn't exist yet. */
    @Transactional
    public String ensureToken(Employee employee) {
        if (employee.getReviewToken() == null || employee.getReviewToken().isBlank()) {
            employee.setReviewToken(UUID.randomUUID().toString().replace("-", ""));
            employeeRepository.save(employee);
        }
        return employee.getReviewToken();
    }

    /** QR + review summary for an employee (HR profile view). */
    @Transactional
    public Map<String, Object> qrInfo(Long employeeId) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found."));
        return qrInfo(e);
    }

    @Transactional
    public Map<String, Object> qrInfo(Employee e) {
        String token = ensureToken(e);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("employeeId", e.getId());
        out.put("employeeName", fullName(e));
        out.put("designation", e.getDesignation());
        out.put("googleReviewUrl", googleReviewUrl());
        Map<String, Object> summary = summaryFor(e.getId());
        out.put("reviewCount", summary.get("count"));
        out.put("averageRating", summary.get("average"));
        return out;
    }

    /** Regenerate the token (the old QR/link stops working). */
    @Transactional
    public Map<String, Object> regenerateToken(Long employeeId) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found."));
        e.setReviewToken(UUID.randomUUID().toString().replace("-", ""));
        employeeRepository.save(e);
        return qrInfo(e);
    }

    // =====================================================================
    // Reviews (CRM/HR read + moderation)
    // =====================================================================

    /** Full review list (incl. hidden) + summary for an employee's profile. */
    @Transactional(readOnly = true)
    public Map<String, Object> listForEmployee(Long employeeId) {
        List<EmployeeReview> reviews =
                reviewRepository.findByEmployeeIdAndIsDeletedFalseOrderByCreatedAtDesc(employeeId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reviews", reviews.stream().map(this::toDto).toList());
        out.putAll(summaryForList(reviews));
        return out;
    }

    @Transactional
    public void setStatus(Long reviewId, String status) {
        EmployeeReview r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found."));
        r.setStatus("HIDDEN".equalsIgnoreCase(status) ? "HIDDEN" : "APPROVED");
        reviewRepository.save(r);
    }

    @Transactional
    public void delete(Long reviewId) {
        EmployeeReview r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found."));
        r.setIsDeleted(true);
        r.setDeletedAt(java.time.LocalDateTime.now());
        reviewRepository.save(r);
    }

    // =====================================================================
    // Google-review rewards (verify → pay a reward via the payroll bonus engine)
    // =====================================================================

    /** The reward-verification board: every QR review that went to Google, plus a per-employee tally. */
    @Transactional(readOnly = true)
    public Map<String, Object> rewardsBoard() {
        List<EmployeeReview> all = reviewRepository.findByRedirectedToGoogleTrueAndIsDeletedFalseOrderByCreatedAtDesc();
        BigDecimal rewardAmount = rewardAmount();

        List<Map<String, Object>> rows = new ArrayList<>();
        // Per-employee aggregates
        Map<Long, Map<String, Object>> byEmp = new LinkedHashMap<>();

        for (EmployeeReview r : all) {
            Employee e = r.getEmployee();
            Long empId = e == null ? null : e.getId();
            rows.add(rewardRow(r));

            if (empId == null) continue;
            Map<String, Object> agg = byEmp.computeIfAbsent(empId, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("employeeId", empId);
                m.put("employeeName", fullName(e));
                m.put("designation", e.getDesignation());
                m.put("totalReviews", 0);
                m.put("verifiedCount", 0);
                m.put("rewardedCount", 0);
                m.put("rewardDue", BigDecimal.ZERO);
                m.put("rewardPaid", BigDecimal.ZERO);
                return m;
            });
            agg.put("totalReviews", (int) agg.get("totalReviews") + 1);
            if (Boolean.TRUE.equals(r.getGoogleVerified())) {
                agg.put("verifiedCount", (int) agg.get("verifiedCount") + 1);
                if (r.getRewardBonusId() != null) {
                    agg.put("rewardedCount", (int) agg.get("rewardedCount") + 1);
                    agg.put("rewardPaid", ((BigDecimal) agg.get("rewardPaid")).add(nz(r.getRewardAmount())));
                } else {
                    agg.put("rewardDue", ((BigDecimal) agg.get("rewardDue")).add(rewardAmount));
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rewardAmount", rewardAmount);
        out.put("rows", rows);
        out.put("byEmployee", new ArrayList<>(byEmp.values()));
        return out;
    }

    /** Mark a review as a confirmed Google review (manually, or with a matched Google review id). */
    @Transactional
    public Map<String, Object> verify(Long reviewId, String googleReviewId) {
        EmployeeReview r = requireReview(reviewId);
        r.setGoogleVerified(true);
        r.setGoogleVerifiedAt(LocalDateTime.now());
        if (googleReviewId != null && !googleReviewId.isBlank()) r.setGoogleReviewId(googleReviewId.trim());
        reviewRepository.save(r);
        return rewardRow(r);
    }

    /** Undo a verification (only while no reward has been paid). */
    @Transactional
    public Map<String, Object> unverify(Long reviewId) {
        EmployeeReview r = requireReview(reviewId);
        if (r.getRewardBonusId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A reward has already been paid for this review; it can't be un-verified.");
        }
        r.setGoogleVerified(false);
        r.setGoogleVerifiedAt(null);
        r.setGoogleReviewId(null);
        reviewRepository.save(r);
        return rewardRow(r);
    }

    /** Pay the reward for a verified review — raises an INCENTIVE bonus on the employee (payslip). */
    @Transactional
    public Map<String, Object> payReward(Long reviewId, User by) {
        EmployeeReview r = requireReview(reviewId);
        if (!Boolean.TRUE.equals(r.getGoogleVerified())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verify the Google review before paying the reward.");
        }
        if (r.getRewardBonusId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A reward has already been paid for this review.");
        }
        Employee e = r.getEmployee();
        if (e == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review is not linked to an employee.");
        BigDecimal amount = rewardAmount();
        if (amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Set a reward amount first (Website → Settings → Reward per Google Review).");
        }
        EmployeeBonus payload = new EmployeeBonus();
        payload.setBonusType("INCENTIVE");
        payload.setAmount(amount);
        payload.setReason("Google review reward — from " + (r.getReviewerName() == null ? "a customer" : r.getReviewerName()));
        EmployeeBonus bonus = payrollService.awardBonus(e.getId(), payload, by);

        r.setRewardBonusId(bonus.getId());
        r.setRewardAmount(amount);
        reviewRepository.save(r);
        return rewardRow(r);
    }

    /** Unverified candidates for the Business Profile auto-match (Layer 2). */
    @Transactional(readOnly = true)
    public List<EmployeeReview> unverifiedCandidates() {
        return reviewRepository.findByGoogleVerifiedFalseAndRedirectedToGoogleTrueAndIsDeletedFalse();
    }

    /** How many QR reviews are still awaiting confirmation (the FIFO pending queue). */
    @Transactional(readOnly = true)
    public int pendingCount() {
        return reviewRepository.findByGoogleVerifiedFalseAndRedirectedToGoogleTrueAndIsDeletedFalse().size();
    }

    /**
     * Count-based auto-verify: Google's total review count rose by {@code n}, so confirm the {@code n}
     * oldest pending QR reviews (FIFO). Marks them verified with a COUNT source; does NOT auto-pay —
     * the reward is still a deliberate click on the rewards board. Returns how many were verified.
     */
    @Transactional
    public int autoVerifyOldestPending(int n) {
        if (n <= 0) return 0;
        List<EmployeeReview> pending =
                reviewRepository.findByGoogleVerifiedFalseAndRedirectedToGoogleTrueAndIsDeletedFalseOrderByCreatedAtAsc();
        int verified = 0;
        LocalDateTime now = LocalDateTime.now();
        for (EmployeeReview r : pending) {
            if (verified >= n) break;
            r.setGoogleVerified(true);
            r.setGoogleVerifiedAt(now);
            r.setGoogleReviewId("COUNT:" + now); // marker: confirmed by a Google count increase
            reviewRepository.save(r);
            verified++;
        }
        return verified;
    }

    private Map<String, Object> rewardRow(EmployeeReview r) {
        Employee e = r.getEmployee();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("employeeId", e == null ? null : e.getId());
        m.put("employeeName", e == null ? "—" : fullName(e));
        m.put("designation", e == null ? null : e.getDesignation());
        m.put("reviewerName", r.getReviewerName());
        m.put("reviewerPhone", r.getReviewerPhone());
        m.put("rating", r.getRating());
        m.put("comment", r.getComment());
        m.put("createdAt", r.getCreatedAt());
        m.put("googleVerified", Boolean.TRUE.equals(r.getGoogleVerified()));
        m.put("googleVerifiedAt", r.getGoogleVerifiedAt());
        m.put("googleReviewId", r.getGoogleReviewId());
        m.put("rewardPaid", r.getRewardBonusId() != null);
        m.put("rewardAmount", r.getRewardAmount());
        return m;
    }

    private EmployeeReview requireReview(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found."));
    }

    private BigDecimal rewardAmount() {
        return settingRepository.findBySettingKeyAndIsDeletedFalse(REWARD_AMOUNT_KEY)
                .map(SiteSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .map(v -> { try { return new BigDecimal(v.trim()); } catch (NumberFormatException ex) { return BigDecimal.ZERO; } })
                .orElse(BigDecimal.ZERO);
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    // =====================================================================
    // Public (scanned QR)
    // =====================================================================

    /** Who the customer is about to review + where they'll be sent. Throws 404 for an unknown token. */
    @Transactional(readOnly = true)
    public Map<String, Object> publicInfo(String token) {
        Employee e = requireByToken(token);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employeeName", fullName(e));
        out.put("designation", e.getDesignation());
        out.put("photoUrl", e.getProfilePhotoUrl());
        out.put("googleReviewUrl", googleReviewUrl());
        return out;
    }

    /** Save the scanned review and hand back the Google review URL to redirect to. */
    @Transactional
    public Map<String, Object> submit(String token, Map<String, Object> body) {
        Employee e = requireByToken(token);

        int rating = clampRating(body.get("rating"));
        EmployeeReview r = new EmployeeReview();
        r.setEmployee(e);
        r.setRating(rating);
        r.setReviewerName(str(body.get("reviewerName")));
        r.setReviewerPhone(str(body.get("reviewerPhone")));
        r.setComment(str(body.get("comment")));
        r.setRedirectedToGoogle(true); // this flow always sends the customer on to Google
        reviewRepository.save(r);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("googleReviewUrl", googleReviewUrl());
        return out;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Employee requireByToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid review link.");
        }
        return employeeRepository.findByReviewTokenAndIsDeletedFalse(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This review link is no longer active."));
    }

    private String googleReviewUrl() {
        return settingRepository.findBySettingKeyAndIsDeletedFalse(GOOGLE_REVIEW_KEY)
                .map(SiteSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .orElse(null);
    }

    private Map<String, Object> summaryFor(Long employeeId) {
        return summaryForList(
                reviewRepository.findByEmployeeIdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(employeeId, "APPROVED"));
    }

    private Map<String, Object> summaryForList(List<EmployeeReview> reviews) {
        List<EmployeeReview> visible = reviews.stream().filter(r -> "APPROVED".equals(r.getStatus())).toList();
        double avg = visible.isEmpty() ? 0
                : visible.stream().mapToInt(EmployeeReview::getRating).average().orElse(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", visible.size());
        out.put("average", Math.round(avg * 10.0) / 10.0);
        return out;
    }

    private Map<String, Object> toDto(EmployeeReview r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("reviewerName", r.getReviewerName());
        m.put("reviewerPhone", r.getReviewerPhone());
        m.put("rating", r.getRating());
        m.put("comment", r.getComment());
        m.put("status", r.getStatus());
        m.put("createdAt", r.getCreatedAt());
        return m;
    }

    private static String fullName(Employee e) {
        return java.util.stream.Stream.of(e.getFirstName(), e.getLastName())
                .filter(s -> s != null && !s.isBlank())
                .reduce((a, b) -> a + " " + b).orElse("Our team member");
    }

    private static int clampRating(Object v) {
        int r = 5;
        if (v instanceof Number n) r = n.intValue();
        else if (v != null) { try { r = Integer.parseInt(v.toString().trim()); } catch (NumberFormatException ignored) {} }
        return Math.max(1, Math.min(5, r));
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }
}
