package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectReviewRepository extends JpaRepository<ProjectReview, Long> {
    List<ProjectReview> findByProjectIdAndIsDeletedFalseOrderByCreatedAtDesc(Long projectId);
    List<ProjectReview> findByProjectIdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(Long projectId, String status);
}
