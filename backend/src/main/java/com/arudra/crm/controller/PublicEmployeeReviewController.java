package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.service.EmployeeReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Public, unauthenticated employee review capture ({@code /api/public/**} is permitAll in
 * SecurityConfig). The token in the path — from the employee's personal review QR code — is the only
 * credential. A scanned customer reads who they're reviewing, submits a rating + message (captured
 * against that employee), and gets back the Google review URL to post publicly. No login.
 */
@RestController
@RequestMapping("/api/public/employee-review")
@CrossOrigin(origins = "*")
public class PublicEmployeeReviewController {

    private final EmployeeReviewService reviews;

    public PublicEmployeeReviewController(EmployeeReviewService reviews) {
        this.reviews = reviews;
    }

    /** Who the customer is about to review, plus the Google review URL they'll be sent to. */
    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> info(@PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.success(reviews.publicInfo(token)));
    }

    /** Capture the review and return the Google review URL to redirect to. */
    @PostMapping("/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submit(
            @PathVariable String token, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(reviews.submit(token, body),
                "Thank you for your feedback!"));
    }

    /** Turn 404/400 from the service into a clean JSON message rather than the app's generic 500. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(ApiResponse.error(ex.getReason()));
    }
}
