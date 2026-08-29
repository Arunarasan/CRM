package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.service.PublicProjectTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Public, unauthenticated project tracking ({@code /api/public/**} is permitAll in SecurityConfig).
 * The share token in the path is the only credential — anyone with the link sees a curated,
 * customer-safe view of one project and can submit a request or leave a review. No login.
 */
@RestController
@RequestMapping("/api/public/track")
@CrossOrigin(origins = "*")
public class PublicProjectTrackingController {

    private final PublicProjectTrackingService tracking;

    public PublicProjectTrackingController(PublicProjectTrackingService tracking) {
        this.tracking = tracking;
    }

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> track(@PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.success(tracking.track(token)));
    }

    @PostMapping("/{token}/requests")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitRequest(
            @PathVariable String token, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(tracking.submitRequest(token, body),
                "Thank you — your request has reached our team."));
    }

    @PostMapping("/{token}/reviews")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitReview(
            @PathVariable String token, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(tracking.submitReview(token, body),
                "Thank you for your feedback!"));
    }

    /** Turn 404/400 from the service into a clean JSON message rather than the app's generic 500. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(ApiResponse.error(ex.getReason()));
    }
}
