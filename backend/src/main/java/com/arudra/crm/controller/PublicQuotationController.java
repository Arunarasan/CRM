package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.service.QuotationShareService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Public, unauthenticated quotation link ({@code /api/public/**} is permitAll in SecurityConfig).
 * The token in the path is the only credential — it opens one quotation's customer view and lets
 * the customer accept it. Nothing else in the CRM is reachable from it.
 */
@RestController
@RequestMapping("/api/public/quote")
@CrossOrigin(origins = "*")
public class PublicQuotationController {

    private final QuotationShareService shareService;

    public PublicQuotationController(QuotationShareService shareService) {
        this.shareService = shareService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> view(@PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.success(shareService.view(token)));
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<ApiResponse<Map<String, Object>>> accept(
            @PathVariable String token, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(shareService.accept(token, body),
                "Thank you — we have received your acceptance and will contact you shortly."));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(ApiResponse.error(ex.getReason()));
    }
}
