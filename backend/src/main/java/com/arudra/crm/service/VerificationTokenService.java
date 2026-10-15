package com.arudra.crm.service;

import com.arudra.crm.entity.User;
import com.arudra.crm.entity.VerificationToken;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.repository.VerificationTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class VerificationTokenService {

    /** Purpose value for password-reset one-time codes. */
    public static final String PURPOSE_PASSWORD_RESET_OTP = "PASSWORD_RESET_OTP";

    /** Purpose value for sign-up email-verification one-time codes. */
    public static final String PURPOSE_EMAIL_VERIFICATION_OTP = "EMAIL_VERIFICATION_OTP";

    private static final SecureRandom RANDOM = new SecureRandom();

    private static final int MAX_OTP_FAILURES = 5;
    /** Wrong reset-code guesses per user id since the last code was issued (single-instance, in memory). */
    private final java.util.concurrent.ConcurrentHashMap<Long, Integer> otpFailures = new java.util.concurrent.ConcurrentHashMap<>();

    @Autowired
    private VerificationTokenRepository verificationTokenRepository;

    @Autowired
    private UserRepository userRepository;

    public VerificationToken createToken(User user, String purpose) {
        VerificationToken token = new VerificationToken();
        token.setUser(user);
        token.setToken(UUID.randomUUID().toString());
        token.setPurpose(purpose);
        // Valid for 24 hours
        token.setExpiryDate(LocalDateTime.now().plusHours(24));
        return verificationTokenRepository.save(token);
    }

    /**
     * Issues a fresh numeric OTP for password reset, invalidating any previous one for the
     * same user so only the latest code works. Returns the raw code so the caller can email it.
     */
    public VerificationToken createPasswordResetOtp(User user, int length, int expiryMinutes) {
        // Only one live reset code per user.
        verificationTokenRepository.deleteByUserAndPurpose(user, PURPOSE_PASSWORD_RESET_OTP);
        otpFailures.remove(user.getId());

        String code = generateNumericCode(length);
        // Guard the global-unique token column against the rare clash with another user's live code.
        while (verificationTokenRepository.findByToken(code).isPresent()) {
            code = generateNumericCode(length);
        }

        VerificationToken token = new VerificationToken();
        token.setUser(user);
        token.setToken(code);
        token.setPurpose(PURPOSE_PASSWORD_RESET_OTP);
        token.setExpiryDate(LocalDateTime.now().plusMinutes(expiryMinutes));
        return verificationTokenRepository.save(token);
    }

    /**
     * Returns the matching, non-expired reset token for this user, or empty if the code is
     * wrong/expired. Does not consume it — the caller deletes it after a successful reset.
     */
    public Optional<VerificationToken> verifyPasswordResetOtp(User user, String otp) {
        // A 6-digit code is brute-forceable, so cap wrong guesses: after MAX_OTP_FAILURES the live
        // code is destroyed and the user must request a new one.
        Optional<VerificationToken> live = verificationTokenRepository.findByUserAndPurpose(user, PURPOSE_PASSWORD_RESET_OTP);
        if (live.isEmpty()) return Optional.empty();
        if (otpFailures.getOrDefault(user.getId(), 0) >= MAX_OTP_FAILURES) {
            verificationTokenRepository.deleteByUserAndPurpose(user, PURPOSE_PASSWORD_RESET_OTP);
            otpFailures.remove(user.getId());
            return Optional.empty();
        }
        boolean ok = otp != null
                && java.security.MessageDigest.isEqual(live.get().getToken().getBytes(), otp.getBytes())
                && !isExpired(live.get());
        if (!ok) {
            if (otpFailures.merge(user.getId(), 1, Integer::sum) >= MAX_OTP_FAILURES) {
                verificationTokenRepository.deleteByUserAndPurpose(user, PURPOSE_PASSWORD_RESET_OTP);
                otpFailures.remove(user.getId());
            }
            return Optional.empty();
        }
        return live;
    }

    /** Issues a fresh numeric email-verification OTP, invalidating any previous one for the user. */
    public VerificationToken createEmailVerificationOtp(User user, int length, int expiryMinutes) {
        verificationTokenRepository.deleteByUserAndPurpose(user, PURPOSE_EMAIL_VERIFICATION_OTP);

        String code = generateNumericCode(length);
        while (verificationTokenRepository.findByToken(code).isPresent()) {
            code = generateNumericCode(length);
        }

        VerificationToken token = new VerificationToken();
        token.setUser(user);
        token.setToken(code);
        token.setPurpose(PURPOSE_EMAIL_VERIFICATION_OTP);
        token.setExpiryDate(LocalDateTime.now().plusMinutes(expiryMinutes));
        return verificationTokenRepository.save(token);
    }

    /** Returns the matching, non-expired email-verification token, or empty if wrong/expired. */
    public Optional<VerificationToken> verifyEmailVerificationOtp(User user, String otp) {
        return verificationTokenRepository.findByUserAndPurpose(user, PURPOSE_EMAIL_VERIFICATION_OTP)
                .filter(t -> t.getToken().equals(otp))
                .filter(t -> !isExpired(t));
    }

    private String generateNumericCode(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    public Optional<VerificationToken> findByToken(String token) {
        return verificationTokenRepository.findByToken(token);
    }

    public boolean isExpired(VerificationToken token) {
        return token.getExpiryDate().isBefore(LocalDateTime.now());
    }

    public void deleteToken(VerificationToken token) {
        verificationTokenRepository.delete(token);
    }
}
