package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorQualityInspection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorQualityInspectionRepository extends JpaRepository<ContractorQualityInspection, Long> {

    List<ContractorQualityInspection> findByWorkPackageIdOrderByIdDesc(Long workPackageId);

    List<ContractorQualityInspection> findByContractorIdOrderByIdDesc(Long contractorId);

    List<ContractorQualityInspection> findByProjectIdOrderByIdDesc(Long projectId);

    List<ContractorQualityInspection> findByResultOrderByIdDesc(String result);

    boolean existsByInspectionNumber(String inspectionNumber);

    @Query("SELECT COUNT(q) FROM ContractorQualityInspection q WHERE q.result IN ('FAIL', 'REWORK') " +
           "AND q.isDeleted = false")
    long countOpenQualityIssues();

    @Query("SELECT AVG(q.score) FROM ContractorQualityInspection q WHERE q.contractor.id = :contractorId " +
           "AND q.score IS NOT NULL AND q.isDeleted = false")
    Double averageScoreForContractor(@Param("contractorId") Long contractorId);
}
