package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskTimeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskTimeLogRepository extends JpaRepository<TaskTimeLog, Long> {
    List<TaskTimeLog> findByTaskId(Long taskId);
    List<TaskTimeLog> findByEmployeeId(Long employeeId);
}
