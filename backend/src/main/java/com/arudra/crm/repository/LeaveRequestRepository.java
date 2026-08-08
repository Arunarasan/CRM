package com.arudra.crm.repository;

import com.arudra.crm.entity.LeaveRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    Page<LeaveRequest> findAllByOrderByStartDateDesc(Pageable pageable);
    List<LeaveRequest> findByEmployeeId(Long employeeId);
    List<LeaveRequest> findByEmployeeIdAndStatus(Long employeeId, String status);
}
