package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectRisk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRiskRepository extends JpaRepository<ProjectRisk, Long> {
    List<ProjectRisk> findByProjectId(Long projectId);
}
