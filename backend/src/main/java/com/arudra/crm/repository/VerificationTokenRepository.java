package com.arudra.crm.repository;

import com.arudra.crm.entity.User;
import com.arudra.crm.entity.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {
    Optional<VerificationToken> findByToken(String token);

    Optional<VerificationToken> findByUserAndPurpose(User user, String purpose);

    List<VerificationToken> findByUserAndPurposeOrderByCreatedAtDesc(User user, String purpose);

    /** Clears any outstanding token for this user+purpose so only the latest OTP is ever valid. */
    @Modifying
    @Transactional
    void deleteByUserAndPurpose(User user, String purpose);
}
