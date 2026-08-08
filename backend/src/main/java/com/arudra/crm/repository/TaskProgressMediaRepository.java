package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskProgressMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskProgressMediaRepository extends JpaRepository<TaskProgressMedia, Long> {
    List<TaskProgressMedia> findByProgressUpdateTaskId(Long taskId);
}
