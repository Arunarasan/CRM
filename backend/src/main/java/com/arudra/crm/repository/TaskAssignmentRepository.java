package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, Long> {
    List<TaskAssignment> findByTaskId(Long taskId);
    List<TaskAssignment> findByEmployeeId(Long employeeId);

    /**
     * A person can hold more than one row on a task (taken off → CANCELLED, then picked/assigned again).
     * Rows come back live-first, newest first, so callers asking for "the" assignment get the current one
     * instead of a NonUniqueResult crash.
     */
    @Query("SELECT a FROM TaskAssignment a WHERE a.task.id = :taskId AND a.employee.id = :employeeId " +
           "ORDER BY CASE WHEN a.status IN ('CANCELLED', 'REJECTED') THEN 1 ELSE 0 END, a.id DESC")
    List<TaskAssignment> findAllByTaskAndEmployeeLiveFirst(@Param("taskId") Long taskId, @Param("employeeId") Long employeeId);

    default Optional<TaskAssignment> findByTaskIdAndEmployeeId(Long taskId, Long employeeId) {
        return findAllByTaskAndEmployeeLiveFirst(taskId, employeeId).stream().findFirst();
    }

    // Unified workforce queries (resource-type agnostic).
    List<TaskAssignment> findByResourceType(String resourceType);
    List<TaskAssignment> findByResourceTypeAndResourceId(String resourceType, Long resourceId);

    @Query("SELECT a FROM TaskAssignment a WHERE a.task.id = :taskId AND a.resourceType = :type AND a.resourceId = :resourceId " +
           "ORDER BY CASE WHEN a.status IN ('CANCELLED', 'REJECTED') THEN 1 ELSE 0 END, a.id DESC")
    List<TaskAssignment> findAllByTaskAndResourceLiveFirst(@Param("taskId") Long taskId, @Param("type") String resourceType,
                                                           @Param("resourceId") Long resourceId);

    /** Live-first like {@link #findByTaskIdAndEmployeeId} — tolerates re-assignment duplicates. */
    default Optional<TaskAssignment> findByTaskIdAndResourceTypeAndResourceId(Long taskId, String resourceType, Long resourceId) {
        return findAllByTaskAndResourceLiveFirst(taskId, resourceType, resourceId).stream().findFirst();
    }
    List<TaskAssignment> findByStatusNot(String status);
    List<TaskAssignment> findByStatusIn(List<String> statuses);

    /** All task assignments across a project's tasks — for the project's people/labour roster. */
    List<TaskAssignment> findByTaskProjectId(Long projectId);

    /** Distinct non-terminal projects a workforce resource is currently assigned to (for the directory). */
    @Query("SELECT COUNT(DISTINCT a.task.project.id) FROM TaskAssignment a " +
           "WHERE a.resourceType = :type AND a.resourceId = :resourceId " +
           "AND a.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')")
    long countActiveProjectsForResource(@Param("type") String type, @Param("resourceId") Long resourceId);
}
