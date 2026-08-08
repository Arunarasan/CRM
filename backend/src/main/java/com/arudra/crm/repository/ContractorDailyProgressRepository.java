package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorDailyProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorDailyProgressRepository extends JpaRepository<ContractorDailyProgress, Long> {

    List<ContractorDailyProgress> findByWorkPackageIdOrderByProgressDateDesc(Long workPackageId);

    List<ContractorDailyProgress> findByContractorIdOrderByProgressDateDesc(Long contractorId);

    List<ContractorDailyProgress> findByProjectIdOrderByProgressDateDesc(Long projectId);

    List<ContractorDailyProgress> findByProgressDateOrderByIdDesc(LocalDate progressDate);

    /** One report per contractor per package per day — repeats update the existing row. */
    Optional<ContractorDailyProgress> findFirstByWorkPackageIdAndContractorIdAndProgressDate(
            Long workPackageId, Long contractorId, LocalDate progressDate);

    @Query("SELECT COALESCE(MAX(p.completionPercentage), 0) FROM ContractorDailyProgress p " +
           "WHERE p.workPackage.id = :workPackageId AND p.status = 'VERIFIED' AND p.isDeleted = false")
    Integer maxVerifiedCompletion(@Param("workPackageId") Long workPackageId);

    @Query("SELECT p FROM ContractorDailyProgress p WHERE p.progressDate BETWEEN :from AND :to " +
           "AND p.isDeleted = false ORDER BY p.progressDate DESC")
    List<ContractorDailyProgress> findBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
