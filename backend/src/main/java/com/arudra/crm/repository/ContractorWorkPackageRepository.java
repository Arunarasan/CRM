package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorWorkPackage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorWorkPackageRepository extends JpaRepository<ContractorWorkPackage, Long> {

    List<ContractorWorkPackage> findByProjectIdOrderByIdDesc(Long projectId);

    List<ContractorWorkPackage> findByPhaseIdOrderByIdAsc(Long phaseId);

    Optional<ContractorWorkPackage> findFirstByProjectIdAndSourceTradeKey(Long projectId, String sourceTradeKey);

    boolean existsByPackageCode(String packageCode);

    /**
     * Single filterable search backing both the module list page and the project tab.
     * Left-joins assignments so a contractor filter doesn't need a second round trip.
     */
    @Query("SELECT DISTINCT wp FROM ContractorWorkPackage wp " +
           "LEFT JOIN WorkPackageAssignment a ON a.workPackage = wp AND a.isDeleted = false " +
           "WHERE (:projectId IS NULL OR wp.project.id = :projectId) " +
           "AND (:phaseId IS NULL OR wp.phase.id = :phaseId) " +
           "AND (:roomId IS NULL OR wp.room.id = :roomId) " +
           "AND (:contractorId IS NULL OR a.contractor.id = :contractorId) " +
           "AND (:trade IS NULL OR wp.trade = :trade) " +
           "AND (:status IS NULL OR wp.status = :status) " +
           "AND (:search IS NULL OR LOWER(wp.packageName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(wp.packageCode) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND wp.isDeleted = false")
    Page<ContractorWorkPackage> search(@Param("projectId") Long projectId,
                                       @Param("phaseId") Long phaseId,
                                       @Param("roomId") Long roomId,
                                       @Param("contractorId") Long contractorId,
                                       @Param("trade") String trade,
                                       @Param("status") String status,
                                       @Param("search") String search,
                                       Pageable pageable);

    @Query("SELECT wp FROM ContractorWorkPackage wp WHERE wp.endDate < :today " +
           "AND wp.status NOT IN ('COMPLETED', 'CANCELLED') AND wp.isDeleted = false")
    List<ContractorWorkPackage> findDelayed(@Param("today") LocalDate today);

    @Query("SELECT COUNT(wp) FROM ContractorWorkPackage wp WHERE wp.status = :status AND wp.isDeleted = false")
    long countByStatus(@Param("status") String status);

    /** Total contractor contract value across all live work packages (finance dashboard). */
    @Query("SELECT COALESCE(SUM(wp.approvedCost), 0) FROM ContractorWorkPackage wp WHERE wp.isDeleted = false")
    java.math.BigDecimal sumAllApprovedCost();

    @Query("SELECT DISTINCT wp FROM ContractorWorkPackage wp " +
           "JOIN WorkPackageAssignment a ON a.workPackage = wp " +
           "WHERE a.contractor.id = :contractorId AND a.isDeleted = false AND wp.isDeleted = false " +
           "ORDER BY wp.id DESC")
    List<ContractorWorkPackage> findByContractorId(@Param("contractorId") Long contractorId);
}
