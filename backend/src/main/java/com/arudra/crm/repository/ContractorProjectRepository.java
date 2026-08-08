package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorProjectRepository extends JpaRepository<ContractorProject, Long> {
    List<ContractorProject> findByContractorId(Long contractorId);
    List<ContractorProject> findByProjectId(Long projectId);
    Optional<ContractorProject> findFirstByContractorIdAndProjectId(Long contractorId, Long projectId);
}
