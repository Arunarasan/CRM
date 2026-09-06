package com.arudra.crm.repository;

import com.arudra.crm.entity.DailyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

    /** An employee's own reports (assignment layer, keyed by users.id). */
    List<DailyReport> findByEmployeeIdAndIsDeletedFalseOrderByReportDateDescIdDesc(Long userId);

    /** Reports tied to a project — surfaced on the Project Command Center. */
    List<DailyReport> findByProjectIdAndIsDeletedFalseOrderByReportDateDescIdDesc(Long projectId);

    /** Reports tied to a lead — surfaced on the Lead profile. */
    List<DailyReport> findByLeadIdAndIsDeletedFalseOrderByReportDateDescIdDesc(Long leadId);

    /**
     * Admin search across every employee, with optional filters. Any null filter is ignored,
     * so the same query backs "all reports" and any narrowed view.
     */
    @Query("SELECT r FROM DailyReport r WHERE r.isDeleted = false "
            + "AND (:employeeId IS NULL OR r.employee.id = :employeeId) "
            + "AND (:projectId IS NULL OR r.project.id = :projectId) "
            + "AND (:leadId IS NULL OR r.lead.id = :leadId) "
            + "AND (:status IS NULL OR r.status = :status) "
            + "AND (:from IS NULL OR r.reportDate >= :from) "
            + "AND (:to IS NULL OR r.reportDate <= :to) "
            + "ORDER BY r.reportDate DESC, r.id DESC")
    List<DailyReport> search(@Param("employeeId") Long employeeId,
                             @Param("projectId") Long projectId,
                             @Param("leadId") Long leadId,
                             @Param("status") String status,
                             @Param("from") LocalDate from,
                             @Param("to") LocalDate to);

    long countByIsDeletedFalseAndReportDateBetween(LocalDate from, LocalDate to);

    long countByIsDeletedFalseAndStatus(String status);
}
