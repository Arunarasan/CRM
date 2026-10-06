package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceShiftRepository extends JpaRepository<AttendanceShift, Long> {
    List<AttendanceShift> findByIsDeletedFalseOrderByNameAsc();

    Optional<AttendanceShift> findFirstByDefaultShiftTrueAndActiveTrueAndIsDeletedFalseOrderByIdAsc();

    List<AttendanceShift> findByDefaultShiftTrueAndIsDeletedFalse();
}
