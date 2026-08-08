package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorMaterialIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ContractorMaterialIssueRepository extends JpaRepository<ContractorMaterialIssue, Long> {

    List<ContractorMaterialIssue> findByWorkPackageIdOrderByIdDesc(Long workPackageId);

    List<ContractorMaterialIssue> findByContractorIdOrderByIdDesc(Long contractorId);

    List<ContractorMaterialIssue> findByProjectIdOrderByIdDesc(Long projectId);

    boolean existsByIssueNumber(String issueNumber);

    /** Material recovery pending against a contractor's next bill, per work package. */
    @Query("SELECT COALESCE(SUM(i.recoverableValue), 0) FROM ContractorMaterialIssue i " +
           "WHERE i.workPackage.id = :workPackageId AND i.status <> 'CANCELLED' AND i.isDeleted = false")
    BigDecimal sumRecoverableByWorkPackage(@Param("workPackageId") Long workPackageId);

    @Query("SELECT COALESCE(SUM(i.totalValue), 0) FROM ContractorMaterialIssue i " +
           "WHERE i.contractor.id = :contractorId AND i.status <> 'CANCELLED' AND i.isDeleted = false")
    BigDecimal sumIssuedValueByContractor(@Param("contractorId") Long contractorId);
}
