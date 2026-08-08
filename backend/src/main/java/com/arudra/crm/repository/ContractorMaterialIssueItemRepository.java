package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorMaterialIssueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorMaterialIssueItemRepository extends JpaRepository<ContractorMaterialIssueItem, Long> {

    List<ContractorMaterialIssueItem> findByIssueIdOrderByIdAsc(Long issueId);

    /** Material consumption report: every line a contractor has been issued across projects. */
    @Query("SELECT i FROM ContractorMaterialIssueItem i WHERE i.issue.contractor.id = :contractorId " +
           "AND i.isDeleted = false ORDER BY i.id DESC")
    List<ContractorMaterialIssueItem> findByContractorId(@Param("contractorId") Long contractorId);

    @Query("SELECT i FROM ContractorMaterialIssueItem i WHERE i.issue.project.id = :projectId " +
           "AND i.isDeleted = false ORDER BY i.id DESC")
    List<ContractorMaterialIssueItem> findByProjectId(@Param("projectId") Long projectId);
}
