package com.arudra.crm.repository;

import com.arudra.crm.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    long countByStatus(String status);
    
    @Query("SELECT p FROM Project p WHERE " +
           "LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Project> searchProjects(@Param("search") String search, Pageable pageable);

    // --- Portfolio segmentation (Projects page tabs: New / In Progress / Completed) ---

    /** Projects whose status falls in the given bucket, with the same name/customer search as the main list. */
    @Query("SELECT p FROM Project p LEFT JOIN p.customer c WHERE UPPER(p.status) IN :statuses AND " +
           "(:search = '' OR LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Project> findByStatusCategory(@Param("statuses") java.util.List<String> statuses,
                                       @Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Project p WHERE UPPER(p.status) IN :statuses")
    long countByStatusCategory(@Param("statuses") java.util.List<String> statuses);

    /** Active = every project not yet finished (anything but COMPLETED / CLOSED / CANCELLED). */
    @Query("SELECT COUNT(p) FROM Project p WHERE p.status IS NULL OR UPPER(p.status) NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')")
    long countActive();

    @Query("SELECT p FROM Project p WHERE p.status IS NULL OR UPPER(p.status) NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')")
    java.util.List<Project> findActive();

    @Query("SELECT p.id FROM Project p WHERE UPPER(p.status) IN ('COMPLETED', 'CLOSED')")
    java.util.List<Long> findFinishedIds();

    /**
     * "Team not assigned": an active project (not completed/closed/cancelled) with nobody on the
     * delivery team — no project manager, site engineer, supervisor and no assigned employees.
     */
    @Query("SELECT p FROM Project p LEFT JOIN p.customer c WHERE " +
           "p.projectManager IS NULL AND p.siteEngineer IS NULL AND p.supervisor IS NULL " +
           "AND p.assignedEmployees IS EMPTY AND UPPER(p.status) NOT IN ('COMPLETED','CLOSED','CANCELLED') AND " +
           "(:search = '' OR LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Project> findUnassignedTeam(@Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Project p WHERE " +
           "p.projectManager IS NULL AND p.siteEngineer IS NULL AND p.supervisor IS NULL " +
           "AND p.assignedEmployees IS EMPTY AND UPPER(p.status) NOT IN ('COMPLETED','CLOSED','CANCELLED')")
    long countUnassignedTeam();

    /** Overdue projects: past their end date and not finished/cancelled — mirrors the dashboard's delayed count. */
    @Query("SELECT p FROM Project p LEFT JOIN p.customer c WHERE p.endDate < :today " +
           "AND UPPER(p.status) NOT IN ('COMPLETED','CANCELLED') AND " +
           "(:search = '' OR LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Project> findDelayed(@Param("today") java.time.LocalDate today,
                              @Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Project p WHERE p.endDate < :today AND UPPER(p.status) NOT IN ('COMPLETED','CANCELLED')")
    long countDelayed(@Param("today") java.time.LocalDate today);

    /**
     * Projects that still owe us money: a live (issued, unpaid) invoice with a balance — or any non-cancelled
     * project whose quote value (else budget) exceeds the verified payments received, invoiced or not.
     */
    @Query("SELECT p FROM Project p LEFT JOIN p.customer c LEFT JOIN p.quotation q WHERE (EXISTS (" +
           "SELECT 1 FROM Invoice i WHERE i.project = p AND UPPER(i.status) NOT IN ('PAID','CANCELLED','DRAFT') " +
           "AND COALESCE(i.balanceDue, i.totalAmount - i.amountPaid) > 0) OR (UPPER(COALESCE(p.status, '')) <> 'CANCELLED' " +
           "AND COALESCE(NULLIF(q.grandTotal, 0), p.budget, 0) > (SELECT COALESCE(SUM(cp.amount), 0) FROM CustomerPayment cp " +
           "WHERE cp.project = p AND cp.status = 'CONFIRMED' AND cp.isDeleted = false))) AND " +
           "(:search = '' OR LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Project> findWithOutstanding(@Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Project p LEFT JOIN p.quotation q WHERE EXISTS (" +
           "SELECT 1 FROM Invoice i WHERE i.project = p AND UPPER(i.status) NOT IN ('PAID','CANCELLED','DRAFT') " +
           "AND COALESCE(i.balanceDue, i.totalAmount - i.amountPaid) > 0) OR (UPPER(COALESCE(p.status, '')) <> 'CANCELLED' " +
           "AND COALESCE(NULLIF(q.grandTotal, 0), p.budget, 0) > (SELECT COALESCE(SUM(cp.amount), 0) FROM CustomerPayment cp " +
           "WHERE cp.project = p AND cp.status = 'CONFIRMED' AND cp.isDeleted = false))")
    long countWithOutstanding();

    java.util.List<Project> findByStatus(String status);
    java.util.List<Project> findByActualCompletionDateBetween(java.time.LocalDate from, java.time.LocalDate to);
    java.util.List<Project> findByCustomerId(Long customerId);
    Page<Project> findByCustomerId(Long customerId, Pageable pageable);
    java.util.List<Project> findByLeadIdOrderByIdDesc(Long leadId);
    boolean existsByBoqId(Long boqId);
    java.util.List<Project> findByBoqId(Long boqId);

    java.util.Optional<Project> findByShareToken(String shareToken);
}
