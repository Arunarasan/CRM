package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskTemplateRepository extends JpaRepository<TaskTemplate, Long> {
    List<TaskTemplate> findByPhaseIdOrderByOrderIndexAsc(Long phaseId);

    /** Live templates only — used when materializing a phase so retired (soft-deleted) task templates
     *  (e.g. the old Schedule/Conduct Visit and Measure Site tasks) are not generated for new leads. */
    List<TaskTemplate> findByPhaseIdAndIsDeletedFalseOrderByOrderIndexAsc(Long phaseId);
}
