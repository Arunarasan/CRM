package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskTimeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaskTimeLogRepository extends JpaRepository<TaskTimeLog, Long> {
    List<TaskTimeLog> findByTaskId(Long taskId);
    List<TaskTimeLog> findByEmployeeId(Long employeeId);

    /** The employee's currently-open timer on a task (not yet stopped), if any. */
    Optional<TaskTimeLog> findFirstByTaskIdAndEmployeeIdAndCompletedAtIsNullOrderByIdDesc(Long taskId, Long employeeId);

    List<TaskTimeLog> findByEmployeeIdAndWorkDateBetweenOrderByWorkDateDescIdDesc(Long employeeId, LocalDate from, LocalDate to);

    List<TaskTimeLog> findByStatusOrderByIdDesc(String status);

    List<TaskTimeLog> findByEmployeeIdAndStatusAndWorkDateBetween(Long employeeId, String status, LocalDate from, LocalDate to);

    /** Approved working minutes for an employee across a payroll period (payroll reads APPROVED only). */
    @Query("SELECT COALESCE(SUM(l.workingTimeMinutes),0) FROM TaskTimeLog l " +
           "WHERE l.employee.id = :eid AND l.status = 'APPROVED' AND l.workDate BETWEEN :from AND :to")
    long sumApprovedWorkingMinutes(@Param("eid") Long employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(l.overtimeMinutes),0) FROM TaskTimeLog l " +
           "WHERE l.employee.id = :eid AND l.status = 'APPROVED' AND l.workDate BETWEEN :from AND :to")
    long sumApprovedOvertimeMinutes(@Param("eid") Long employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
