package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectActivityLogRepository extends JpaRepository<ProjectActivityLog, Long> {
    List<ProjectActivityLog> findByProjectIdOrderByTimeDesc(Long projectId);
}
