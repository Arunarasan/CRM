package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectDailyLogEmployee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectDailyLogEmployeeRepository extends JpaRepository<ProjectDailyLogEmployee, Long> {
    List<ProjectDailyLogEmployee> findByDailyLogId(Long dailyLogId);
}
