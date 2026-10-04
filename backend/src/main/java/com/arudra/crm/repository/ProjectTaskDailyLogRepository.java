package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectTaskDailyLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTaskDailyLogRepository extends JpaRepository<ProjectTaskDailyLog, Long> {
    List<ProjectTaskDailyLog> findByTaskIdAndIsDeletedFalseOrderByLogDateDescIdDesc(Long taskId);

    List<ProjectTaskDailyLog> findByProjectIdAndIsDeletedFalseOrderByLogDateDescIdDesc(Long projectId);
}
