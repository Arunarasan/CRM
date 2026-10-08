package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceCorrectionRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceCorrectionRequestRepository extends JpaRepository<AttendanceCorrectionRequest, Long> {

    List<AttendanceCorrectionRequest> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<AttendanceCorrectionRequest> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /** A correction request points at one of these sessions — they must not be rebuilt or deleted. */
    boolean existsByAttendanceSessionIdIn(java.util.Collection<Long> sessionIds);
}
