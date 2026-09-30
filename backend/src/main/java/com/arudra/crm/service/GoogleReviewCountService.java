package com.arudra.crm.service;

import com.arudra.crm.entity.GoogleReviewCounter;
import com.arudra.crm.repository.GoogleReviewCounterRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Count-based auto-verification of Google reviews — the simple path that needs only a Places API key
 * (no Business Profile API approval). Polls the business's public total review count
 * ({@code user_ratings_total}); when it rises by N, the N oldest pending QR reviews are auto-verified
 * (FIFO) via {@link EmployeeReviewService#autoVerifyOldestPending(int)}.
 *
 * <p>A review is only ever confirmed by a REAL increase in Google's count — that is the anti-fraud
 * guard the whole idea rests on. Config lives in backend env (NOT site_settings, which is public):
 * <pre>
 *   crm.google-places.api-key=...
 *   crm.google-places.place-id=ChIJ....
 * </pre>
 *
 * <p>Note the honest limits: Google's count updates with a delay (so this reconciles periodically,
 * not instantly), and simultaneous reviews are attributed FIFO — admins can still override on the
 * rewards board. The first sync only establishes a baseline (pre-existing reviews are never rewarded).
 */
@Service
public class GoogleReviewCountService {

    private static final Logger log = LoggerFactory.getLogger(GoogleReviewCountService.class);
    private static final String PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
    private static final long COUNTER_ID = 1L;

    @Value("${crm.google-places.api-key:}")
    private String apiKey;
    @Value("${crm.google-places.place-id:}")
    private String placeId;

    private final GoogleReviewCounterRepository counterRepo;
    private final EmployeeReviewService reviewService;
    private final RestTemplate http = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    public GoogleReviewCountService(GoogleReviewCounterRepository counterRepo, EmployeeReviewService reviewService) {
        this.counterRepo = counterRepo;
        this.reviewService = reviewService;
    }

    public boolean isConfigured() {
        return notBlank(apiKey) && notBlank(placeId);
    }

    /** Current status for the rewards board (no API call): last total, baseline, pending queue size. */
    @Transactional(readOnly = true)
    public Map<String, Object> status() {
        GoogleReviewCounter c = counter();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configured", isConfigured());
        out.put("lastTotal", c.getLastTotal());
        out.put("baseline", c.getBaseline());
        out.put("lastSyncedAt", c.getLastSyncedAt());
        out.put("pending", reviewService.pendingCount());
        return out;
    }

    /**
     * Fetch the live Google total and reconcile: on first sync set the baseline; afterwards verify the
     * N oldest pending reviews for a +N increase. Returns a summary for the UI.
     */
    @Transactional
    public Map<String, Object> reconcile() {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!isConfigured()) {
            out.put("configured", false);
            out.put("message", "Google Places is not connected. Set crm.google-places.api-key + place-id to enable count sync.");
            return out;
        }

        Integer total;
        try {
            total = fetchTotal();
        } catch (Exception ex) {
            log.warn("Google review count fetch failed", ex);
            out.put("configured", true);
            out.put("message", "Could not reach Google: " + ex.getMessage());
            return out;
        }
        if (total == null) {
            out.put("configured", true);
            out.put("message", "Google did not return a review count for this place id.");
            return out;
        }

        GoogleReviewCounter c = counter();
        Integer previous = c.getLastTotal();
        int autoVerified = 0;
        boolean baselineSet = false;

        if (previous == null) {
            // First ever sync — establish the baseline; reward nothing retroactively.
            c.setBaseline(total);
            baselineSet = true;
        } else {
            int delta = total - previous;
            if (delta > 0) autoVerified = reviewService.autoVerifyOldestPending(delta);
            // delta <= 0 (Google removed reviews / unchanged) → nothing to verify.
        }
        c.setLastTotal(total);
        c.setLastSyncedAt(LocalDateTime.now());
        counterRepo.save(c);

        out.put("configured", true);
        out.put("previousTotal", previous);
        out.put("currentTotal", total);
        out.put("delta", previous == null ? 0 : total - previous);
        out.put("baselineSet", baselineSet);
        out.put("autoVerified", autoVerified);
        out.put("pending", reviewService.pendingCount());
        return out;
    }

    // ---- helpers ----------------------------------------------------------

    private Integer fetchTotal() throws Exception {
        String url = UriComponentsBuilder.fromHttpUrl(PLACE_DETAILS_URL)
                .queryParam("place_id", placeId)
                .queryParam("fields", "user_ratings_total")
                .queryParam("key", apiKey)
                .toUriString();
        String body = http.getForObject(url, String.class);
        JsonNode root = mapper.readTree(body);
        String apiStatus = root.path("status").asText("");
        if (!"OK".equals(apiStatus)) {
            throw new IllegalStateException("Places API status: " + apiStatus
                    + (root.hasNonNull("error_message") ? " — " + root.path("error_message").asText() : ""));
        }
        JsonNode n = root.path("result").path("user_ratings_total");
        return n.isMissingNode() || n.isNull() ? null : n.asInt();
    }

    private GoogleReviewCounter counter() {
        return counterRepo.findById(COUNTER_ID).orElseGet(() -> {
            GoogleReviewCounter c = new GoogleReviewCounter();
            return counterRepo.save(c);
        });
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
