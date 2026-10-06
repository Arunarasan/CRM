package com.arudra.crm.repository;

import com.arudra.crm.entity.BiometricEnrollmentSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface BiometricEnrollmentSessionRepository extends JpaRepository<BiometricEnrollmentSession, Long> {
    List<BiometricEnrollmentSession> findByDeviceIdAndStatusInOrderByIdAsc(Long deviceId, Collection<String> statuses);

    List<BiometricEnrollmentSession> findByEmployeeIdAndStatusIn(Long employeeId, Collection<String> statuses);

    List<BiometricEnrollmentSession> findTop10ByEmployeeIdOrderByIdDesc(Long employeeId);
}
