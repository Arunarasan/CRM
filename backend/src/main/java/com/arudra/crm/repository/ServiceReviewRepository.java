package com.arudra.crm.repository;

import com.arudra.crm.entity.ServiceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceReviewRepository extends JpaRepository<ServiceReview, Long> {

    // Portal
    List<ServiceReview> findByService_IdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(Long serviceId, String status);
    Optional<ServiceReview> findByService_IdAndCustomer_IdAndIsDeletedFalse(Long serviceId, Long customerId);

    // Public (approved only)
    List<ServiceReview> findByService_SlugAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(String slug, String status);

    // Admin moderation
    List<ServiceReview> findByIsDeletedFalseOrderByCreatedAtDesc();
    Optional<ServiceReview> findByIdAndIsDeletedFalse(Long id);
}
