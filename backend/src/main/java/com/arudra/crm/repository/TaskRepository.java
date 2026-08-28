package com.arudra.crm.repository;

import com.arudra.crm.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    long countByStatus(String status);
    
    @Query("SELECT t FROM Task t WHERE " +
           "LOWER(t.taskName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.project.projectName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Task> searchTasks(@Param("search") String search, Pageable pageable);

    @Query("SELECT t FROM Task t WHERE t.dueDate = :today AND t.status != 'COMPLETED'")
    java.util.List<Task> findTasksDueToday(@Param("today") java.time.LocalDate today);
    java.util.List<com.arudra.crm.entity.Task> findByProjectCustomerIdOrderByDueDateAsc(Long customerId);
    Page<com.arudra.crm.entity.Task> findByProjectCustomerIdOrderByDueDateAsc(Long customerId, Pageable pageable);

    java.util.List<com.arudra.crm.entity.Task> findByProjectId(Long projectId);

    /**
     * Batch task tallies for the Projects portfolio list, so the "Tasks done/total" column is
     * populated in one query instead of one-per-row. Returns rows of [projectId, total, done].
     */
    @Query("SELECT t.project.id, COUNT(t), " +
           "SUM(CASE WHEN LOWER(t.status) = 'completed' THEN 1 ELSE 0 END) " +
           "FROM Task t WHERE t.project.id IN :projectIds GROUP BY t.project.id")
    java.util.List<Object[]> tallyTasksByProjectIds(@Param("projectIds") java.util.List<Long> projectIds);

    boolean existsByGeneratedFromBoqItemId(Long boqItemId);
    java.util.Optional<com.arudra.crm.entity.Task> findByGeneratedFromBoqItemId(Long boqItemId);
    long countByStatusNot(String status);

    // ---- workflow engine (V33) ----
    java.util.List<Task> findByWorkflowInstanceId(Long workflowInstanceId);
    java.util.List<Task> findByWorkflowPhaseInstanceId(Long workflowPhaseInstanceId);
    java.util.List<Task> findByLeadId(Long leadId);
    /** Idempotency guard for progressive generation: has this template already produced a task in this run? */
    boolean existsByTaskTemplateIdAndWorkflowInstanceId(Long taskTemplateId, Long workflowInstanceId);
    java.util.List<Task> findBySourceAndStatus(String source, String status);
    java.util.List<Task> findByStatus(String status);

    /** Row lock for atomic pick/join — serializes concurrent claims of the same task. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Task t WHERE t.id = :id")
    java.util.Optional<Task> findByIdForUpdate(@Param("id") Long id);

    /** Open (not done/cancelled) tasks whose due date has passed — for overdue escalation. */
    @Query("SELECT t FROM Task t WHERE t.dueDate < :today AND t.status NOT IN ('COMPLETED','CANCELLED')")
    java.util.List<Task> findOverdue(@Param("today") java.time.LocalDate today);
}