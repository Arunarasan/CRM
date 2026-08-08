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
    List<Attendance> findByEmployeeIdAndDateBetween(Long employeeId, LocalDate from, LocalDate to);
    java.util.Optional<Attendance> findFirstByEmployeeIdAndDateOrderByIdDesc(Long employeeId, LocalDate date);
}
