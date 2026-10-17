package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectAdjustmentRepository extends JpaRepository<ProjectAdjustment, Long> {
    List<ProjectAdjustment> findByProjectIdAndIsDeletedFalseOrderByIdDesc(Long projectId);
}
