package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    /** Sessions on days before {@code cutoff} that still carry a kiosk selfie and are not waiting on HR approval. */
    @org.springframework.data.jpa.repository.Query("select s from AttendanceSession s join fetch s.attendance a "
            + "where a.date < :cutoff and (s.selfieInUrl is not null or s.selfieOutUrl is not null) "
            + "and (s.approvalStatus is null or s.approvalStatus <> 'PENDING')")
    List<AttendanceSession> findWithOldSelfies(@org.springframework.data.repository.query.Param("cutoff") java.time.LocalDate cutoff);

    List<AttendanceSession> findByAttendanceIdOrderByIdAsc(Long attendanceId);

    /** Still clocked-in sessions not yet flagged for the "no clock-out" alert. */
    List<AttendanceSession> findByCheckOutTimeIsNullAndOvertimeAlertSentFalse();

    /** Sessions still open on a day before {@code today}, not yet flagged — the "forgot to check out" sweep. */
    @org.springframework.data.jpa.repository.Query("select s from AttendanceSession s join fetch s.attendance a join fetch a.employee e "
            + "where s.checkOutTime is null and s.checkInTime is not null and (s.flagged is null or s.flagged = false) "
            + "and a.date < :today and a.date >= :since")
    List<AttendanceSession> findUnflaggedOpenBefore(java.time.LocalDate today, java.time.LocalDate since);

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
