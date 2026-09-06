package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadTaskSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeadTaskSubmissionRepository extends JpaRepository<LeadTaskSubmission, Long> {
    List<LeadTaskSubmission> findByLeadIdOrderBySubmittedAtDesc(Long leadId);
    List<LeadTaskSubmission> findByTaskIdOrderBySubmittedAtDesc(Long taskId);

    /** The latest not-yet-applied submission for a task — applied to the lead when the task is approved. */
    Optional<LeadTaskSubmission> findFirstByTaskIdAndAppliedFalseOrderBySubmittedAtDescIdDesc(Long taskId);
}
