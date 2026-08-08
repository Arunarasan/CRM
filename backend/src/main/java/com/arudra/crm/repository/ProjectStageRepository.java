package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectStageRepository extends JpaRepository<ProjectStage, Long> {
    List<ProjectStage> findByProjectId(Long projectId);
    List<ProjectStage> findByProjectIdOrderByDueDateAsc(Long projectId);
}
