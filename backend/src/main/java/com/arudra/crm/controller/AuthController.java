package com.arudra.crm.controller;

import com.arudra.crm.dto.AuthRequest;
import com.arudra.crm.dto.AuthResponse;
import com.arudra.crm.entity.LoginHistory;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.LoginHistoryRepository;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.security.JwtUtil;
import com.arudra.crm.service.RefreshTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private com.arudra.crm.security.AuthCookies authCookies;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

    @Autowired
    private com.arudra.crm.security.CurrentUserService currentUserService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest authRequest, HttpServletRequest request,
                                   jakarta.servlet.http.HttpServletResponse response) {
        String ipAddress = request.getRemoteAddr();
        // The "email" field may carry a phone number instead; resolve it to the account's email.
        authRequest.setEmail(resolveLoginEmail(authRequest.getEmail()));

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getEmail(), authRequest.getPassword())
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String token = jwtUtil.generateToken(userDetails);

            User user = userRepository.findByEmail(authRequest.getEmail()).orElseThrow();

            // Reset failed attempts on success
            if (user.getFailedAttempts() > 0) {
                user.setFailedAttempts(0);
                userRepository.save(user);
            }

            // Generate Refresh Token
            // The refresh token travels only in an HttpOnly cookie — never in the body or localStorage.
            var refresh = refreshTokenService.createRefreshToken(user.getId(), authRequest.isRememberMe());
            authCookies.setSession(response, refresh.refreshToken(), refresh.expiry(), token);

            // Log history
            logHistory(user, authRequest.getEmail(), ipAddress, "SUCCESS");

            List<String> roles = userDetails.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(new AuthResponse(token, null, user.getEmail(), user.getName(), roles, user.isMustChangePassword()));

        } catch (DisabledException ex) {
            // enabled == emailVerified (CustomUserDetailsService): the account isn't active.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "This account isn't active yet. Please contact our team."));
        } catch (BadCredentialsException ex) {
            handleFailedAttempt(authRequest.getEmail(), ipAddress);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false, "message", "Invalid email or password"));
        } catch (LockedException ex) {
            return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of("success", false, "message", "Too many failed attempts. Please wait a few minutes and try again, or reset your password."));
        } catch (Exception ex) {
            // Details go to the log only; the client gets a generic message.
            log.error("Login failed unexpectedly for {}", authRequest.getEmail(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("success", false,
                    "message", "Sign-in failed. Please try again."));
        }
    }

    @Autowired
    private com.arudra.crm.repository.EmployeeRepository employeeRepository;

    /**
     * Accepts an email as-is, or a phone number (matched on its last 10 digits against user
     * accounts first, then active employees) and returns that account's login email. An unknown or ambiguous phone is returned
     * unchanged so authentication fails with the same generic "Invalid email or password".
     */
    private String resolveLoginEmail(String identifier) {
        if (identifier == null) return null;
        String id = identifier.trim();
        if (id.contains("@")) return id;
        String digits = id.replaceAll("\\D", "");
        if (digits.length() < 10) return id;
        String tail = digits.substring(digits.length() - 10);
        List<String> userEmails = userRepository.findByPhoneIsNotNull().stream()
                .filter(u -> {
                    String d = u.getPhone().replaceAll("\\D", "");
                    return d.length() >= 10 && d.endsWith(tail);
                })
                .map(User::getEmail)
                .distinct()
                .collect(Collectors.toList());
        if (userEmails.size() == 1) return userEmails.get(0);
        if (userEmails.size() > 1) return id;
        List<String> emails = employeeRepository.findByPhoneIsNotNullAndIsDeletedFalse().stream()
                .filter(e -> {
                    String d = e.getPhone().replaceAll("\\D", "");
                    return d.length() >= 10 && d.endsWith(tail);
                })
                .map(com.arudra.crm.entity.Employee::getEmail)
                .distinct()
                .collect(Collectors.toList());
        return emails.size() == 1 ? emails.get(0) : id;
    }

    private void handleFailedAttempt(String email, String ipAddress) {
        userRepository.findByEmail(email).ifPresent(user -> {
            int newAttempts = user.getFailedAttempts() + 1;
            user.setFailedAttempts(newAttempts);
            if (newAttempts % com.arudra.crm.security.CustomUserDetailsService.MAX_FAILED_ATTEMPTS == 0) {
                user.setAccountNonLocked(false);
                user.setLockTime(LocalDateTime.now());
            }
            userRepository.save(user);
            logHistory(user, email, ipAddress, "FAILED");
        });
    }

    private void logHistory(User user, String email, String ipAddress, String status) {
        LoginHistory history = new LoginHistory();
        history.setUser(user);
        history.setAttemptedEmail(email);
        history.setIpAddress(ipAddress);
        history.setStatus(status);
        history.setLoginTime(LocalDateTime.now());
        loginHistoryRepository.save(history);
    }

    @Autowired
    private com.arudra.crm.security.CustomUserDetailsService customUserDetailsService;

    @Autowired
    private com.arudra.crm.service.VerificationTokenService verificationTokenService;

    @Autowired
    private com.arudra.crm.service.EmailService emailService;

    @org.springframework.beans.factory.annotation.Value("${app.otp.length:6}")
    private int otpLength;

    @org.springframework.beans.factory.annotation.Value("${app.otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    /**
     * Swaps a refresh token for a new access token AND a new refresh token (the old one stops
     * working). A disabled, locked or deleted account gets 401 and loses its tokens.
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody(required = false) com.arudra.crm.dto.TokenRefreshRequest request,
                                          HttpServletRequest httpRequest,
                                          jakarta.servlet.http.HttpServletResponse response) {
        ResponseEntity<Object> invalid = ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("success", false, "message", "Refresh token is invalid or expired!"));
        // Cookie first; a body token is still accepted from sessions started before the cookie switch.
        String presented = com.arudra.crm.security.AuthCookies.read(httpRequest, com.arudra.crm.security.AuthCookies.REFRESH);
        if (presented == null && request != null) presented = request.getRefreshToken();
        var rotation = refreshTokenService.rotate(presented).orElse(null);
        if (rotation == null) {
            authCookies.clear(response);
            return invalid;
        }
        UserDetails userDetails;
        try {
            userDetails = customUserDetailsService.loadUserByUsername(rotation.user().getEmail());
        } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
            return invalid;
        }
        if (!userDetails.isEnabled() || !userDetails.isAccountNonLocked()) {
            refreshTokenService.revokeAll(rotation.user());
            authCookies.clear(response);
            return invalid;
        }
        String token = jwtUtil.generateToken(userDetails);
        authCookies.setSession(response, rotation.refreshToken(), rotation.expiry(), token);
        return ResponseEntity.ok(new com.arudra.crm.dto.TokenRefreshResponse(token, null));
    }

    /**
     * Ends the session: revokes the presented refresh token, and every refresh token of the
     * signed-in user when called with a valid access token. Always succeeds.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody(required = false) Map<String, String> body,
                                    HttpServletRequest httpRequest,
                                    jakarta.servlet.http.HttpServletResponse response) {
        refreshTokenService.revoke(com.arudra.crm.security.AuthCookies.read(httpRequest, com.arudra.crm.security.AuthCookies.REFRESH));
        if (body != null) refreshTokenService.revoke(body.get("refreshToken"));
        authCookies.clear(response);
        User user = currentUserService.getCurrentUser();
        if (user != null) refreshTokenService.revokeAll(user);
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("success", true, "message", "Signed out."));
    }

    /**
     * Step 1: e-mail a one-time code to the account if it exists. Always returns the same
     * generic success so the response can't be used to enumerate which emails are registered.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody com.arudra.crm.dto.ForgotPasswordRequest request) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        userRepository.findByEmail(email).ifPresent(user -> {
            com.arudra.crm.entity.VerificationToken token =
                    verificationTokenService.createPasswordResetOtp(user, otpLength, otpExpiryMinutes);
            emailService.sendPasswordResetOtp(user.getEmail(), user.getName(), token.getToken(), otpExpiryMinutes);
        });
        return ResponseEntity.ok(Map.of("success", true,
                "message", "If an account exists for that email, a verification code has been sent."));
    }

    /** Step 2 (optional): confirm the OTP is valid before showing the new-password fields. */
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody com.arudra.crm.dto.VerifyOtpRequest request) {
        boolean valid = userRepository.findByEmail(request.getEmail() == null ? "" : request.getEmail().trim())
                .flatMap(user -> verificationTokenService.verifyPasswordResetOtp(user, request.getOtp()))
                .isPresent();
        if (valid) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Code verified."));
        }
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or expired code."));
    }

    /** Step 3: verify the OTP and set the new password. */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody com.arudra.crm.dto.PasswordResetRequest request) {
        String newPassword = request.getNewPassword();
        String problem = com.arudra.crm.security.PasswordPolicy.validate(newPassword, request.getEmail());
        if (problem != null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", problem));
        }
        return userRepository.findByEmail(request.getEmail() == null ? "" : request.getEmail().trim())
                .flatMap(user -> verificationTokenService.verifyPasswordResetOtp(user, request.getOtp())
                        .map(token -> {
                            user.setPassword(passwordEncoder.encode(newPassword));
                            // A successful reset also clears any lockout from prior failed logins
                            // and satisfies any forced first-login password change. Completing the
                            // OTP proves ownership of the email, so mark it verified — this also
                            // self-heals an account left inactive (email_verified = 0), which the
                            // login flow would otherwise reject with 403.
                            user.setFailedAttempts(0);
                            user.setAccountNonLocked(true);
                            user.setLockTime(null);
                            user.setMustChangePassword(false);
                            user.setEmailVerified(true);
                            userRepository.save(user);
                            refreshTokenService.revokeAll(user); // sign out every device
                            verificationTokenService.deleteToken(token);
                            return ResponseEntity.ok(Map.of("success", true,
                                    "message", "Password reset successfully. You can now sign in."));
                        }))
                .orElse(ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Invalid or expired code.")));
    }

    /**
     * Self-service password change for the signed-in user (any role — admin/staff on the
     * desktop ERP). Verifies the current password before setting the new one. The employee
     * mobile portal has its own equivalent under /api/employee-portal/change-password.
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changeOwnPassword(@RequestBody Map<String, String> body,
                                               jakarta.servlet.http.HttpServletResponse response) {
        User user = currentUserService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Not signed in."));
        }
        String current = body.getOrDefault("currentPassword", "");
        String next = body.getOrDefault("newPassword", "");
        String problem = com.arudra.crm.security.PasswordPolicy.validate(next, user.getEmail());
        if (problem != null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", problem));
        }
        if (passwordEncoder.matches(next, user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", "New password must be different from the current one."));
        }
        if (!passwordEncoder.matches(current, user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", "Current password is incorrect."));
        }
        user.setPassword(passwordEncoder.encode(next));
        user.setMustChangePassword(false);
        userRepository.save(user);
        // Sign out every other device, then hand this one a fresh session so it stays signed in.
        refreshTokenService.revokeAll(user);
        var refresh = refreshTokenService.createRefreshToken(user.getId(), false);
        String token = jwtUtil.generateToken(customUserDetailsService.loadUserByUsername(user.getEmail()));
        authCookies.setSession(response, refresh.refreshToken(), refresh.expiry(), token);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password updated.",
                "data", Map.of("token", token)));
    }
}
