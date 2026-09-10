package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceLocationRepository extends JpaRepository<AttendanceLocation, Long> {
    List<AttendanceLocation> findByActiveTrueAndIsDeletedFalse();

    List<AttendanceLocation> findByIsDeletedFalseOrderByNameAsc();
}
