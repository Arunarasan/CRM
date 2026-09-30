package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeReview;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Optional Layer 2: pulls the company's real Google reviews via the Google Business Profile API and
 * auto-suggests which employee earned each one, by matching the reviewer's name + time against the
 * reviews captured when customers scanned an employee's QR ({@link EmployeeReviewService}).
 *
 * <p>Entirely config-guarded: if the Google credentials aren't set, {@link #isConfigured()} is false
 * and the manual verify/reward flow (Layer 1) is unaffected. Secrets live in backend config/env
 * (NEVER in site_settings, which is exposed publicly), e.g.:
 * <pre>
 *   crm.google-business.client-id=...
 *   crm.google-business.client-secret=...
 *   crm.google-business.refresh-token=...
 *   crm.google-business.location-name=accounts/123/locations/456
 * </pre>
 * Requires Google Business Profile API access (approved by Google) + an OAuth refresh token from the
 * account that manages the Business Profile.
 */
@Service
public class GoogleBusinessReviewService {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String REVIEWS_URL = "https://mybusiness.googleapis.com/v4/%s/reviews";
    /** How far apart (days) a captured scan and a Google review can be and still count as a match. */
    private static final long MATCH_WINDOW_DAYS = 14;

    @Value("${crm.google-business.client-id:}")
    private String clientId;
    @Value("${crm.google-business.client-secret:}")
    private String clientSecret;
    @Value("${crm.google-business.refresh-token:}")
    private String refreshToken;
    /** Full resource name: accounts/{acc}/locations/{loc}. */
    @Value("${crm.google-business.location-name:}")
    private String locationName;

    private final EmployeeReviewService reviewService;
    private final RestTemplate http = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    public GoogleBusinessReviewService(EmployeeReviewService reviewService) {
        this.reviewService = reviewService;
    }

    public boolean isConfigured() {
        return notBlank(clientId) && notBlank(clientSecret) && notBlank(refreshToken) && notBlank(locationName);
    }

    /**
     * Fetch Google reviews and suggest a match for each still-unverified captured review. The admin
     * confirms a suggestion, which runs the normal verify → reward path. Never auto-pays.
     */
    public Map<String, Object> suggestMatches() {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!isConfigured()) {
            out.put("configured", false);
            out.put("message", "Google Business Profile is not connected. Set the crm.google-business.* config to enable auto-matching.");
            out.put("suggestions", List.of());
            return out;
        }

        List<Map<String, Object>> googleReviews;
        try {
            googleReviews = fetchGoogleReviews();
        } catch (Exception ex) {
            out.put("configured", true);
            out.put("message", "Could not reach Google Business Profile: " + ex.getMessage());
            out.put("suggestions", List.of());
            return out;
        }

        List<EmployeeReview> candidates = reviewService.unverifiedCandidates();
        List<Map<String, Object>> suggestions = new ArrayList<>();

        for (EmployeeReview c : candidates) {
            String ourName = norm(c.getReviewerName());
            if (ourName.isEmpty() || c.getCreatedAt() == null) continue;
            for (Map<String, Object> g : googleReviews) {
                String gName = norm((String) g.get("reviewerName"));
                OffsetDateTime gTime = (OffsetDateTime) g.get("createTime");
                if (gName.isEmpty()) continue;
                boolean nameHit = gName.equals(ourName) || gName.contains(ourName) || ourName.contains(gName);
                boolean timeHit = gTime == null || Math.abs(Duration.between(
                        c.getCreatedAt().atOffset(gTime.getOffset()), gTime).toDays()) <= MATCH_WINDOW_DAYS;
                if (nameHit && timeHit) {
                    Employee e = c.getEmployee();
                    Map<String, Object> s = new LinkedHashMap<>();
                    s.put("reviewId", c.getId());
                    s.put("employeeName", e == null ? "—" : (e.getFirstName() + " " + e.getLastName()).trim());
                    s.put("ourReviewerName", c.getReviewerName());
                    s.put("googleReviewId", g.get("reviewId"));
                    s.put("googleReviewerName", g.get("reviewerName"));
                    s.put("googleStars", g.get("stars"));
                    s.put("googleComment", g.get("comment"));
                    s.put("googleCreateTime", gTime);
                    s.put("confidence", gName.equals(ourName) ? "HIGH" : "MEDIUM");
                    suggestions.add(s);
                    break; // one suggestion per captured review
                }
            }
        }

        out.put("configured", true);
        out.put("googleReviewCount", googleReviews.size());
        out.put("suggestions", suggestions);
        return out;
    }

    // ---- Google API calls -------------------------------------------------

    private String accessToken() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        ResponseEntity<String> resp = http.postForEntity(TOKEN_URL, new HttpEntity<>(form, h), String.class);
        try {
            return mapper.readTree(resp.getBody()).path("access_token").asText();
        } catch (Exception e) {
            throw new IllegalStateException("Google token exchange failed", e);
        }
    }

    private List<Map<String, Object>> fetchGoogleReviews() throws Exception {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(accessToken());
        String url = String.format(REVIEWS_URL, locationName);
        ResponseEntity<String> resp = http.exchange(url, HttpMethod.GET, new HttpEntity<>(h), String.class);
        JsonNode root = mapper.readTree(resp.getBody());

        List<Map<String, Object>> reviews = new ArrayList<>();
        for (JsonNode n : root.path("reviews")) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("reviewId", n.path("reviewId").asText(null));
            r.put("reviewerName", n.path("reviewer").path("displayName").asText(null));
            r.put("stars", starToInt(n.path("starRating").asText(null)));
            r.put("comment", n.path("comment").asText(null));
            String create = n.path("createTime").asText(null);
            r.put("createTime", create == null ? null : OffsetDateTime.parse(create));
            reviews.add(r);
        }
        return reviews;
    }

    private static int starToInt(String s) {
        if (s == null) return 0;
        return switch (s) {
            case "FIVE" -> 5; case "FOUR" -> 4; case "THREE" -> 3; case "TWO" -> 2; case "ONE" -> 1;
            default -> 0;
        };
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
