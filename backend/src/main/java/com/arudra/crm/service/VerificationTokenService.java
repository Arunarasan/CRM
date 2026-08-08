package com.arudra.crm.service;

import com.arudra.crm.entity.User;
import com.arudra.crm.entity.VerificationToken;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.repository.VerificationTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class VerificationTokenService {

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
