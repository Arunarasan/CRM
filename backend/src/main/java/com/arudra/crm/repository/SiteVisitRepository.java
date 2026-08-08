package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteVisit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SiteVisitRepository extends JpaRepository<SiteVisit, Long>, JpaSpecificationExecutor<SiteVisit> {

    List<SiteVisit> findByCustomerIdAndIsDeletedFalseOrderByScheduledTimeDesc(Long customerId);

    Page<SiteVisit> findByCustomerIdAndIsDeletedFalseOrderByScheduledTimeDesc(Long customerId, Pageable pageable);

    List<SiteVisit> findByLeadIdAndIsDeletedFalseOrderByScheduledDateDesc(Long leadId);

    List<SiteVisit> findByProjectIdAndIsDeletedFalseOrderByScheduledDateDesc(Long projectId);

    Page<SiteVisit> findByProjectIdAndIsDeletedFalseOrderByScheduledDateDesc(Long projectId, Pageable pageable);

    long countByLeadIdAndScheduledDateAndIsDeletedFalse(Long leadId, LocalDate date);

    @Query("SELECT v FROM SiteVisit v WHERE v.scheduledDate = :date AND v.lead IS NOT NULL AND v.isDeleted = false")
    List<SiteVisit> findLeadVisitsScheduledOn(@Param("date") LocalDate date);

    long countByScheduledDateAndLeadIsNotNullAndIsDeletedFalse(LocalDate date);

    // --- Visit number generation (SV-000001 pattern) ---
    @Query("SELECT v.visitNumber FROM SiteVisit v WHERE v.visitNumber LIKE 'SV-%' ORDER BY v.visitNumber DESC")
    List<String> findLatestVisitNumbers(Pageable pageable);

    // --- Dashboard counts (all exclude soft-deleted visits) ---
    long countByIsDeletedFalseAndScheduledDate(LocalDate date);

    long countByIsDeletedFalseAndScheduledDateAfter(LocalDate date);

    long countByIsDeletedFalseAndStatus(String status);

    long countByIsDeletedFalseAndStatusAndScheduledDateBefore(String status, LocalDate date);

    long countByIsDeletedFalseAndScheduledDateBetween(LocalDate start, LocalDate end);

    @Query("SELECT AVG(FUNCTION('TIMESTAMPDIFF', MINUTE, v.actualStartTime, v.actualEndTime)) " +
           "FROM SiteVisit v WHERE v.isDeleted = false AND v.actualStartTime IS NOT NULL AND v.actualEndTime IS NOT NULL")
    Double averageVisitDurationMinutes();

    @Query("SELECT u.id, u.name, COUNT(a) FROM SiteVisitAssignment a JOIN a.assignedUser u " +
           "JOIN a.siteVisit v WHERE v.isDeleted = false AND v.scheduledDate BETWEEN :start AND :end " +
           "GROUP BY u.id, u.name ORDER BY COUNT(a) DESC")
    List<Object[]> mostActiveEmployees(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT v FROM SiteVisit v WHERE v.isDeleted = false AND (" +
           "LOWER(v.visitNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.customerContactPerson) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.customerMobile) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.project.projectName) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<SiteVisit> searchVisits(@Param("search") String search, Pageable pageable);

    List<SiteVisit> findByReminderEnabledTrueAndReminderSentFalseAndScheduledDateAndIsDeletedFalse(LocalDate date);
}
