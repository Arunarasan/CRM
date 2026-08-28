package com.arudra.crm.controller;

import com.arudra.crm.dto.AuthRequest;
import com.arudra.crm.dto.AuthResponse;
import com.arudra.crm.entity.LoginHistory;
import com.arudra.crm.entity.RefreshToken;
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
@CrossOrigin(origins = "*")
public class AuthController {

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
    private LoginHistoryRepository loginHistoryRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest authRequest, HttpServletRequest request) {
        String ipAddress = request.getRemoteAddr();
        
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
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getId(), authRequest.isRememberMe());

            // Log history
            logHistory(user, authRequest.getEmail(), ipAddress, "SUCCESS");

            List<String> roles = userDetails.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(new AuthResponse(token, refreshToken.getToken(), user.getEmail(), user.getName(), roles, user.isMustChangePassword()));

        } catch (DisabledException ex) {
            // enabled == emailVerified (CustomUserDetailsService): the account isn't active.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "This account isn't active yet. Please contact our team."));
        } catch (BadCredentialsException ex) {
            handleFailedAttempt(authRequest.getEmail(), ipAddress);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false, "message", "Invalid email or password"));
        } catch (LockedException ex) {
            return ResponseEntity.status(HttpStatus.LOCKED).body(Map.of("success", false, "message", "Account is locked due to too many failed attempts. Please try again later."));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("success", false, "message", ex.getMessage()));
        }
    }

    private void handleFailedAttempt(String email, String ipAddress) {
        userRepository.findByEmail(email).ifPresent(user -> {
            int newAttempts = user.getFailedAttempts() + 1;
            user.setFailedAttempts(newAttempts);
            if (newAttempts >= 5) {
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

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody com.arudra.crm.dto.TokenRefreshRequest request) {
        String requestRefreshToken = request.getRefreshToken();

        return refreshTokenService.findByToken(requestRefreshToken)
                .map(refreshTokenService::verifyExpiration)
                .map(RefreshToken::getUser)
                .map(user -> {
                    UserDetails userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
                    String token = jwtUtil.generateToken(userDetails);
                    return (ResponseEntity<Object>) ResponseEntity.ok((Object) new com.arudra.crm.dto.TokenRefreshResponse(token, requestRefreshToken));
                })
                .orElse((ResponseEntity<Object>) ResponseEntity.status(HttpStatus.UNAUTHORIZED).body((Object) Map.of("success", false, "message", "Refresh token is invalid or expired!")));
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
        if (newPassword == null || newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", "Password must be at least 6 characters."));
        }
        return userRepository.findByEmail(request.getEmail() == null ? "" : request.getEmail().trim())
                .flatMap(user -> verificationTokenService.verifyPasswordResetOtp(user, request.getOtp())
                        .map(token -> {
                            user.setPassword(passwordEncoder.encode(newPassword));
                            // A successful reset also clears any lockout from prior failed logins
                            // and satisfies any forced first-login password change.
                            user.setFailedAttempts(0);
                            user.setAccountNonLocked(true);
                            user.setLockTime(null);
                            user.setMustChangePassword(false);
                            userRepository.save(user);
                            verificationTokenService.deleteToken(token);
                            return ResponseEntity.ok(Map.of("success", true,
                                    "message", "Password reset successfully. You can now sign in."));
                        }))
                .orElse(ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Invalid or expired code.")));
    }
}
