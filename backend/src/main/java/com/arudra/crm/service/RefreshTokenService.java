package com.arudra.crm.service;

import com.arudra.crm.entity.RefreshToken;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.RefreshTokenRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class RefreshTokenService {

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    public RefreshToken createRefreshToken(Long userId, boolean rememberMe) {
        RefreshToken refreshToken = new RefreshToken();
        User user = userRepository.findById(userId).orElseThrow();

        // Delete existing refresh token for this user (only 1 active device allowed in this simple model)
        refreshTokenRepository.deleteByUser(user);
        refreshTokenRepository.flush();

        refreshToken.setUser(user);
        
        // 30 days for remember me, 7 days default
        long expiryMillis = rememberMe ? 30L * 24 * 60 * 60 * 1000 : 7L * 24 * 60 * 60 * 1000;
        refreshToken.setExpiryDate(Instant.now().plusMillis(expiryMillis));
        refreshToken.setToken(UUID.randomUUID().toString());

        return refreshTokenRepository.save(refreshToken);
    }

    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().compareTo(Instant.now()) < 0) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException(token.getToken() + " Refresh token was expired. Please make a new signin request");
        }
        return token;
    }
    
    @Transactional
    public int deleteByUserId(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return refreshTokenRepository.deleteByUser(user);
    }
}
