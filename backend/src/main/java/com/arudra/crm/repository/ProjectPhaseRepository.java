package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectPhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectPhaseRepository extends JpaRepository<ProjectPhase, Long> {
    List<ProjectPhase> findByProjectIdOrderBySequenceAsc(Long projectId);
    Optional<ProjectPhase> findByProjectIdAndBoqPhaseId(Long projectId, Long boqPhaseId);
}
