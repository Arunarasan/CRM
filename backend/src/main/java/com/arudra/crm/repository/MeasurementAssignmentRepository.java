package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeasurementAssignmentRepository extends JpaRepository<MeasurementAssignment, Long> {

    List<MeasurementAssignment> findByMeasurementIdOrderByAssignedDateAsc(Long measurementId);

    Optional<MeasurementAssignment> findByMeasurementIdAndEmployeeIdAndRole(Long measurementId, Long employeeId, String role);

    List<MeasurementAssignment> findByEmployeeIdAndStatus(Long employeeId, String status);

    /** Engineer with the most completed assignments in a window — dashboard "most active engineer". */
    @Query("SELECT a.employee.name, COUNT(a) FROM MeasurementAssignment a "
            + "WHERE a.completedTime BETWEEN :from AND :to GROUP BY a.employee.name ORDER BY COUNT(a) DESC")
    List<Object[]> countCompletedByEmployee(LocalDateTime from, LocalDateTime to);
}
