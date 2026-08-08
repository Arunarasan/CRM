package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTeamRepository extends JpaRepository<ProjectTeam, Long> {
    List<ProjectTeam> findByProjectId(Long projectId);
    List<ProjectTeam> findByEmployeeId(Long employeeId);
}
