package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectChangeRequestPhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectChangeRequestPhaseRepository extends JpaRepository<ProjectChangeRequestPhase, Long> {
    List<ProjectChangeRequestPhase> findByChangeRequestId(Long changeRequestId);
}
