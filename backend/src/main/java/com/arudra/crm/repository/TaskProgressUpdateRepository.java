package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskProgressUpdate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskProgressUpdateRepository extends JpaRepository<TaskProgressUpdate, Long> {
    List<TaskProgressUpdate> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}
