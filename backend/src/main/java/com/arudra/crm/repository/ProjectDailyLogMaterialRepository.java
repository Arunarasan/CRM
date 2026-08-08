package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectDailyLogMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectDailyLogMaterialRepository extends JpaRepository<ProjectDailyLogMaterial, Long> {
    List<ProjectDailyLogMaterial> findByDailyLogId(Long dailyLogId);
}
