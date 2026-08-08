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
    Optional<TaskAssignment> findByTaskIdAndEmployeeId(Long taskId, Long employeeId);

    // Unified workforce queries (resource-type agnostic).
    List<TaskAssignment> findByResourceType(String resourceType);
    List<TaskAssignment> findByResourceTypeAndResourceId(String resourceType, Long resourceId);
    Optional<TaskAssignment> findByTaskIdAndResourceTypeAndResourceId(Long taskId, String resourceType, Long resourceId);
    List<TaskAssignment> findByStatusNot(String status);

    /** Distinct non-terminal projects a workforce resource is currently assigned to (for the directory). */
    @Query("SELECT COUNT(DISTINCT a.task.project.id) FROM TaskAssignment a " +
           "WHERE a.resourceType = :type AND a.resourceId = :resourceId " +
           "AND a.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')")
    long countActiveProjectsForResource(@Param("type") String type, @Param("resourceId") Long resourceId);
}
