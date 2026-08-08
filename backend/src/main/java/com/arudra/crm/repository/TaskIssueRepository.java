package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskIssueRepository extends JpaRepository<TaskIssue, Long> {
    List<TaskIssue> findByTaskIdOrderByReportedAtDesc(Long taskId);
    List<TaskIssue> findByStatus(String status);
}
