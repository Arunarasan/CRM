package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.AttendanceKiosk;
import com.arudra.crm.service.FingerprintService;
import com.arudra.crm.service.KioskPunchService;
import com.arudra.crm.service.KioskService;
import com.arudra.crm.util.RequestIp;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * The office kiosk phone's own API. Under {@code /api/public/**} (permitAll): there is no user login
 * on a kiosk. The pairing code (once) and then the {@code X-Kiosk-Token} header are the credentials.
 */
@RestController
@RequestMapping("/api/public/kiosk")
public class KioskController {

    static final String TOKEN_HEADER = "X-Kiosk-Token";

    private final KioskService kioskService;
    private final KioskPunchService punchService;

    public KioskController(KioskService kioskService, KioskPunchService punchService) {
        this.kioskService = kioskService;
        this.punchService = punchService;
    }

    @PostMapping("/pair")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pair(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String code = body.get("code") == null ? null : String.valueOf(body.get("code"));
        String deviceInfo = body.get("deviceInfo") == null ? request.getHeader("User-Agent") : String.valueOf(body.get("deviceInfo"));
        return ResponseEntity.ok(ApiResponse.success(kioskService.pair(code, deviceInfo, RequestIp.of(request))));
    }

    /** Who am I? Also the kiosk's heartbeat; 401 means the token was revoked and the phone must re-pair. */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> me(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token, HttpServletRequest request) {
        AttendanceKiosk k = kioskService.authenticate(token, RequestIp.of(request));
        return ResponseEntity.ok(ApiResponse.success(kioskService.me(k)));
    }

    /**
     * A face punch: the live face descriptor + a selfie. The server identifies the employee itself, so the
     * response says who was recognised and what was recorded (CHECKED_IN / CHECKED_OUT, or why nothing was).
     */
    @PostMapping(value = "/punch", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> punch(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestParam("action") String action,
            @RequestParam("descriptor") String descriptor,
            @RequestParam(value = "liveness", required = false) String liveness,
            @RequestPart(value = "selfie", required = false) org.springframework.web.multipart.MultipartFile selfie,
            HttpServletRequest request) throws java.io.IOException {
        AttendanceKiosk kiosk = kioskService.authenticate(token, RequestIp.of(request));
        byte[] bytes = selfie == null ? null : selfie.getBytes();
        String type = selfie == null ? null : selfie.getContentType();
        return ResponseEntity.ok(ApiResponse.success(punchService.punch(kiosk, action, descriptor, liveness, bytes, type)));
    }

    /**
     * A fingerprint punch: the sensor capture (image or ISO template, as JSON) + a selfie as evidence.
     * Like the face punch, the server identifies the employee itself.
     */
    @PostMapping(value = "/punch-finger", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> punchFinger(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestParam("action") String action,
            @RequestParam("capture") String captureJson,
            @RequestPart(value = "selfie", required = false) org.springframework.web.multipart.MultipartFile selfie,
            HttpServletRequest request) throws java.io.IOException {
        AttendanceKiosk kiosk = kioskService.authenticate(token, RequestIp.of(request));
        FingerprintService.Capture capture = FingerprintAdminController.parseCapture(captureJson);
        byte[] bytes = selfie == null ? null : selfie.getBytes();
        String type = selfie == null ? null : selfie.getContentType();
        return ResponseEntity.ok(ApiResponse.success(punchService.punchFinger(kiosk, action, capture, bytes, type)));
    }

    /** Fallback punch by employee ID / phone + a photo; always lands as pending admin approval. */
    @PostMapping(value = "/punch-manual", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> punchManual(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestParam("action") String action,
            @RequestParam("identifier") String identifier,
            @RequestPart(value = "selfie", required = false) org.springframework.web.multipart.MultipartFile selfie,
            HttpServletRequest request) throws java.io.IOException {
        AttendanceKiosk kiosk = kioskService.authenticate(token, RequestIp.of(request));
        byte[] bytes = selfie == null ? null : selfie.getBytes();
        String type = selfie == null ? null : selfie.getContentType();
        return ResponseEntity.ok(ApiResponse.success(punchService.punchManual(kiosk, action, identifier, bytes, type)));
    }
}
