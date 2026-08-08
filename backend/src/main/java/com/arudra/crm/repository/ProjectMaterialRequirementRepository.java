package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectMaterialRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMaterialRequirementRepository extends JpaRepository<ProjectMaterialRequirement, Long> {
    List<ProjectMaterialRequirement> findByProjectIdOrderByIdAsc(Long projectId);
    Optional<ProjectMaterialRequirement> findByProjectIdAndProductIdAndPhaseId(Long projectId, Long productId, Long phaseId);
}
