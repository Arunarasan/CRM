package com.arudra.crm.repository;

import com.arudra.crm.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByEmployeeId(Long employeeId);
    List<Attendance> findByDate(LocalDate date);

    @org.springframework.data.jpa.repository.Query("SELECT a.status, COUNT(DISTINCT a.employee.id) FROM Attendance a "
            + "WHERE a.date = :date AND a.employee.status = 'ACTIVE' AND a.employee.isDeleted = false GROUP BY a.status")
    List<Object[]> countByStatusForDate(@org.springframework.data.repository.query.Param("date") LocalDate date);
    List<Attendance> findByEmployeeIdAndDateBetween(Long employeeId, LocalDate from, LocalDate to);
    java.util.Optional<Attendance> findFirstByEmployeeIdAndDateOrderByIdDesc(Long employeeId, LocalDate date);
}
