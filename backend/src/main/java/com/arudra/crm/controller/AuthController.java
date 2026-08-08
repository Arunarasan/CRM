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

            return ResponseEntity.ok(new AuthResponse(token, refreshToken.getToken(), user.getEmail(), user.getName(), roles));

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

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody com.arudra.crm.dto.ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            com.arudra.crm.entity.VerificationToken token = verificationTokenService.createToken(user, "PASSWORD_RESET");
            // Mock email sending
            System.out.println("MOCK EMAIL SENDER: Password reset link: http://localhost:5173/reset-password?token=" + token.getToken());
        });
        // Always return success to prevent email enumeration
        return ResponseEntity.ok(Map.of("success", true, "message", "If the email exists, a password reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody com.arudra.crm.dto.PasswordResetRequest request) {
        return verificationTokenService.findByToken(request.getToken())
                .filter(token -> !verificationTokenService.isExpired(token))
                .filter(token -> "PASSWORD_RESET".equals(token.getPurpose()))
                .map(token -> {
                    User user = token.getUser();
                    user.setPassword(passwordEncoder.encode(request.getNewPassword()));
                    userRepository.save(user);
                    verificationTokenService.deleteToken(token);
                    return ResponseEntity.ok(Map.of("success", true, "message", "Password reset successfully."));
                })
                .orElse(ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid or expired token.")));
    }
}
