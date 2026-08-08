package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskMaterialUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskMaterialUsageRepository extends JpaRepository<TaskMaterialUsage, Long> {
    List<TaskMaterialUsage> findByTaskIdOrderByUsedAtDesc(Long taskId);
}
