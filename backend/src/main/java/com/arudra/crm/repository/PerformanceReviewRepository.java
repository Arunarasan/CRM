package com.arudra.crm.repository;

import com.arudra.crm.entity.PerformanceReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Long> {
    Page<PerformanceReview> findAllByOrderByReviewDateDesc(Pageable pageable);
    List<PerformanceReview> findByEmployeeIdOrderByReviewDateDesc(Long employeeId);
}
