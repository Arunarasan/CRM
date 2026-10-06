package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceDeviceEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceDeviceEventRepository extends JpaRepository<AttendanceDeviceEvent, Long> {
    List<AttendanceDeviceEvent> findByDeviceIdOrderByOccurredAtDesc(Long deviceId, Pageable pageable);
}
