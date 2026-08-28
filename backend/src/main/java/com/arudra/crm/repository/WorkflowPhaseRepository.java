package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkflowPhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowPhaseRepository extends JpaRepository<WorkflowPhase, Long> {
    List<WorkflowPhase> findByTemplateIdOrderByOrderIndexAsc(Long templateId);

    /** Live phases only — used when materializing a NEW workflow instance so retired (soft-deleted)
     *  phases (e.g. the old standalone Measurement phase) are not generated for new leads. */
    List<WorkflowPhase> findByTemplateIdAndIsDeletedFalseOrderByOrderIndexAsc(Long templateId);
}
