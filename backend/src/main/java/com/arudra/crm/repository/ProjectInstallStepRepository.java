package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectInstallStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectInstallStepRepository extends JpaRepository<ProjectInstallStep, Long> {
    List<ProjectInstallStep> findByInstallCategoryIdInAndIsDeletedFalseOrderBySortOrderAscIdAsc(List<Long> categoryIds);

    List<ProjectInstallStep> findByInstallCategoryIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long categoryId);
}
