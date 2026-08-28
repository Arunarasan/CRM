package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkflowPhaseInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowPhaseInstanceRepository extends JpaRepository<WorkflowPhaseInstance, Long> {
    List<WorkflowPhaseInstance> findByWorkflowInstanceIdOrderByIdAsc(Long workflowInstanceId);
}
