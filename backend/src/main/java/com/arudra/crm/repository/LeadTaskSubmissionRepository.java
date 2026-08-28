package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadTaskSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadTaskSubmissionRepository extends JpaRepository<LeadTaskSubmission, Long> {
    List<LeadTaskSubmission> findByLeadIdOrderBySubmittedAtDesc(Long leadId);
    List<LeadTaskSubmission> findByTaskIdOrderBySubmittedAtDesc(Long taskId);
}
