package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskCheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskCheckInRepository extends JpaRepository<TaskCheckIn, Long> {
    List<TaskCheckIn> findByTaskIdOrderByCheckInTimeDesc(Long taskId);
    Optional<TaskCheckIn> findFirstByTaskIdAndEmployeeIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(Long taskId, Long employeeId);
}
