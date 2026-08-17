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

    java.util.List<Project> findByStatus(String status);
    java.util.List<Project> findByCustomerId(Long customerId);
    Page<Project> findByCustomerId(Long customerId, Pageable pageable);
    java.util.List<Project> findByLeadIdOrderByIdDesc(Long leadId);
    boolean existsByBoqId(Long boqId);
}
