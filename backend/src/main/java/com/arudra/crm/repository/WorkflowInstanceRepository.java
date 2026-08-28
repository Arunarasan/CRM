package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkflowInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, Long> {
    List<WorkflowInstance> findByLeadId(Long leadId);
    List<WorkflowInstance> findByProjectId(Long projectId);
    /** Guard against double-instantiation from a re-fired trigger. */
    Optional<WorkflowInstance> findFirstByScopeAndLeadIdAndStatus(String scope, Long leadId, String status);
    Optional<WorkflowInstance> findFirstByScopeAndProjectIdAndStatus(String scope, Long projectId, String status);
}
