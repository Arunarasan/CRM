package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    List<AttendanceSession> findByAttendanceIdOrderByIdAsc(Long attendanceId);

    /** Still clocked-in sessions not yet flagged for the "no clock-out" alert. */
    List<AttendanceSession> findByCheckOutTimeIsNullAndOvertimeAlertSentFalse();
}
