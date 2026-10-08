package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceMachineRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceMachineRequestRepository extends JpaRepository<AttendanceMachineRequest, Long> {

    Optional<AttendanceMachineRequest> findBySerialNumber(String serialNumber);

    List<AttendanceMachineRequest> findByDismissedFalseAndIsDeletedFalseOrderByLastSeenAtDesc();
}
