package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceKiosk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceKioskRepository extends JpaRepository<AttendanceKiosk, Long> {
    List<AttendanceKiosk> findByIsDeletedFalseOrderByNameAsc();

    Optional<AttendanceKiosk> findByTokenHashAndIsDeletedFalse(String tokenHash);

    Optional<AttendanceKiosk> findByPairingCodeHashAndIsDeletedFalse(String pairingCodeHash);
}
