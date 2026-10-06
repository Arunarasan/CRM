package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendancePunch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AttendancePunchRepository extends JpaRepository<AttendancePunch, Long> {
    Optional<AttendancePunch> findByDeviceIdAndIdempotencyKey(Long deviceId, String idempotencyKey);
}
