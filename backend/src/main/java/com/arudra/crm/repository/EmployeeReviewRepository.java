package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeReviewRepository extends JpaRepository<EmployeeReview, Long> {

    /** All reviews for one employee, newest first (admin/HR view — includes hidden). */
    List<EmployeeReview> findByEmployeeIdAndIsDeletedFalseOrderByCreatedAtDesc(Long employeeId);

    /** Approved reviews only, newest first. */
    List<EmployeeReview> findByEmployeeIdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(Long employeeId, String status);

    long countByEmployeeIdAndStatusAndIsDeletedFalse(Long employeeId, String status);

    // --- Google-review rewards ---
    /** All QR reviews that were sent to Google — the reward-verification candidates. */
    List<EmployeeReview> findByRedirectedToGoogleTrueAndIsDeletedFalseOrderByCreatedAtDesc();

    /** Unverified candidates — what the Business Profile auto-match runs against. */
    List<EmployeeReview> findByGoogleVerifiedFalseAndRedirectedToGoogleTrueAndIsDeletedFalse();

    /** Unverified candidates oldest first — FIFO queue for count-based auto-verification. */
    List<EmployeeReview> findByGoogleVerifiedFalseAndRedirectedToGoogleTrueAndIsDeletedFalseOrderByCreatedAtAsc();

    long countByEmployeeIdAndGoogleVerifiedTrueAndIsDeletedFalse(Long employeeId);

    /** Reviews whose reward raised one of these bonuses — lets a payslip count review rewards. */
    List<EmployeeReview> findByRewardBonusIdIn(java.util.Collection<Long> bonusIds);
}
