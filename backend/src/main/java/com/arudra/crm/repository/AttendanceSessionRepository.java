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

    /** Flagged clock-ins awaiting HR review (attendance verification, newest first). */
    List<AttendanceSession> findByFlaggedTrueAndApprovalStatusOrderByIdDesc(String approvalStatus);

    long countByFlaggedTrueAndApprovalStatus(String approvalStatus);

    /** Sessions punched on an office kiosk (either half), newest first, optionally for one employee. */
    @org.springframework.data.jpa.repository.Query("select s from AttendanceSession s join fetch s.attendance a join fetch a.employee e "
            + "where (s.checkInSource = 'KIOSK' or s.checkOutSource = 'KIOSK') and a.date between :from and :to "
            + "and (:employeeId is null or e.id = :employeeId) order by a.date desc, s.id desc")
    List<AttendanceSession> findKioskSessions(java.time.LocalDate from, java.time.LocalDate to, Long employeeId,
                                              org.springframework.data.domain.Pageable page);
}
