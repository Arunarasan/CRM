package com.arudra.crm.repository;

import com.arudra.crm.entity.Lead;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LeadRepository extends JpaRepository<Lead, Long>, JpaSpecificationExecutor<Lead> {
    
    @Query("SELECT l FROM Lead l WHERE " +
           "LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.companyName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Lead> searchLeads(@Param("search") String search, Pageable pageable);

    @Query("SELECT l.status, COUNT(l) FROM Lead l GROUP BY l.status")
    java.util.List<Object[]> countLeadsByStatus();

    @Query("SELECT l FROM Lead l WHERE l.nextFollowUpDate = :today")
    java.util.List<Lead> findLeadsForFollowUp(@Param("today") java.time.LocalDate today);
    
    java.util.List<com.arudra.crm.entity.Lead> findByConvertedToCustomerId(Long customerId);

    // Employee portal: leads a field employee raised (they own via lead_owner_id) — the
    // "own leads only" scope for the create-only self-service lead flow.
    java.util.List<Lead> findByLeadOwnerIdAndIsDeletedFalseOrderByIdDesc(Long ownerId);

    Page<Lead> findByConvertedToCustomerId(Long customerId, Pageable pageable);

    // --- Lead number generation (LEAD-000001 pattern) ---
    @Query("SELECT l.leadNumber FROM Lead l WHERE l.leadNumber LIKE 'LEAD-%' ORDER BY l.leadNumber DESC")
    java.util.List<String> findLatestLeadNumbers(Pageable pageable);

    // --- Dashboard counts (all exclude soft-deleted leads) ---
    long countByIsDeletedFalse();

    long countByIsDeletedFalseAndCreatedAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);

    long countByIsDeletedFalseAndLeadTemperatureIgnoreCaseAndIsConvertedFalse(String temperature);

    long countByIsDeletedFalseAndIsConvertedTrue();

    long countByIsDeletedFalseAndStatusIgnoreCase(String status);

    long countByIsDeletedFalseAndStatusIn(java.util.Collection<String> statuses);

    long countByIsDeletedFalseAndNextFollowUpDateAndIsConvertedFalse(java.time.LocalDate date);

    long countByIsDeletedFalseAndNextFollowUpDateBeforeAndIsConvertedFalseAndStatusNotIn(
            java.time.LocalDate date, java.util.Collection<String> statuses);

    java.util.List<Lead> findByIsDeletedFalseAndNextFollowUpDateAndIsConvertedFalse(java.time.LocalDate date);

    java.util.List<Lead> findByIsDeletedFalseAndNextFollowUpDateBeforeAndIsConvertedFalseAndStatusNotIn(
            java.time.LocalDate date, java.util.Collection<String> statuses);

    // --- Reports ---
    @Query("SELECT COALESCE(l.leadSource, 'Unknown'), COUNT(l), " +
           "SUM(CASE WHEN l.isConverted = true THEN 1 ELSE 0 END), " +
           "SUM(CASE WHEN l.status = 'Lost' THEN 1 ELSE 0 END), " +
           "COALESCE(SUM(l.estimatedBudget), 0) " +
           "FROM Lead l WHERE l.isDeleted = false " +
           "GROUP BY COALESCE(l.leadSource, 'Unknown') ORDER BY COUNT(l) DESC")
    java.util.List<Object[]> aggregateBySource();

    @Query("SELECT u.id, u.name, COUNT(l), " +
           "SUM(CASE WHEN l.isConverted = true THEN 1 ELSE 0 END), " +
           "SUM(CASE WHEN l.status = 'Lost' THEN 1 ELSE 0 END), " +
           "COALESCE(SUM(l.estimatedBudget), 0) " +
           "FROM Lead l JOIN l.assignedSalesExecutive u WHERE l.isDeleted = false " +
           "GROUP BY u.id, u.name ORDER BY COUNT(l) DESC")
    java.util.List<Object[]> aggregateByExecutive();

    @Query("SELECT FUNCTION('DATE_FORMAT', l.createdAt, '%Y-%m'), COUNT(l), " +
           "SUM(CASE WHEN l.isConverted = true THEN 1 ELSE 0 END) " +
           "FROM Lead l WHERE l.isDeleted = false AND l.createdAt >= :from " +
           "GROUP BY FUNCTION('DATE_FORMAT', l.createdAt, '%Y-%m') " +
           "ORDER BY FUNCTION('DATE_FORMAT', l.createdAt, '%Y-%m')")
    java.util.List<Object[]> aggregateMonthly(@Param("from") java.time.LocalDateTime from);

    @Query("SELECT COALESCE(l.lostReason, 'Unspecified'), COUNT(l) " +
           "FROM Lead l WHERE l.isDeleted = false AND l.status = 'Lost' " +
           "GROUP BY COALESCE(l.lostReason, 'Unspecified') ORDER BY COUNT(l) DESC")
    java.util.List<Object[]> aggregateLostReasons();

    @Query("SELECT AVG(FUNCTION('DATEDIFF', l.convertedDate, l.createdAt)) " +
           "FROM Lead l WHERE l.isDeleted = false AND l.isConverted = true AND l.convertedDate IS NOT NULL")
    Double averageSalesCycleDays();

    @Query("SELECT l.status, COUNT(l), " +
           "COALESCE(SUM(COALESCE(l.expectedProjectValue, l.estimatedBudget)), 0) " +
           "FROM Lead l WHERE l.isDeleted = false AND l.isConverted = false " +
           "AND l.status NOT IN :closedStatuses GROUP BY l.status")
    java.util.List<Object[]> aggregateOpenPipeline(
            @Param("closedStatuses") java.util.Collection<String> closedStatuses);

    @Query("SELECT COALESCE(l.stage, 'New Lead'), COUNT(l) FROM Lead l WHERE l.isDeleted = false " +
           "GROUP BY COALESCE(l.stage, 'New Lead')")
    java.util.List<Object[]> countLeadsByStage();
}