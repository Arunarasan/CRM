package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectIssueRepository extends JpaRepository<ProjectIssue, Long> {
    List<ProjectIssue> findByProjectId(Long projectId);
}
