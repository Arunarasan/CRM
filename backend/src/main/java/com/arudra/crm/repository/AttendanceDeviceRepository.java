package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceDeviceRepository extends JpaRepository<AttendanceDevice, Long> {
    List<AttendanceDevice> findByIsDeletedFalseOrderByIdDesc();

    Optional<AttendanceDevice> findByDeviceUuidAndIsDeletedFalse(String deviceUuid);

    Optional<AttendanceDevice> findByIdAndIsDeletedFalse(Long id);

    List<AttendanceDevice> findByStatusAndIsDeletedFalse(String status);

    /** Unpaired admin-created slots whose pairing code is still valid. */
    List<AttendanceDevice> findByPairingCodeHashIsNotNullAndDeviceUuidIsNullAndIsDeletedFalse();

    @Query("select d from AttendanceDevice d where d.isDeleted = false and d.status = 'ACTIVE' "
            + "and d.offlineAlertSent = false and d.lastSeenAt is not null and d.lastSeenAt < :cutoff")
    List<AttendanceDevice> findNewlyOffline(LocalDateTime cutoff);

    @Query("select max(d.id) from AttendanceDevice d")
    Long maxId();
}
