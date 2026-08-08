package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectItemProgressLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectItemProgressLogRepository extends JpaRepository<ProjectItemProgressLog, Long> {
    List<ProjectItemProgressLog> findByItemIdOrderByLogTimeAsc(Long itemId);
}
