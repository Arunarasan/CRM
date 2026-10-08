package com.arudra.crm.repository;

import com.arudra.crm.entity.AttendanceMachine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceMachineRepository extends JpaRepository<AttendanceMachine, Long> {

    Optional<AttendanceMachine> findBySerialNumberAndIsDeletedFalse(String serialNumber);

    List<AttendanceMachine> findByIsDeletedFalseOrderByNameAsc();

    List<AttendanceMachine> findByActiveTrueAndIsDeletedFalse();
}
