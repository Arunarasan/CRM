package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectInstallCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectInstallCategoryRepository extends JpaRepository<ProjectInstallCategory, Long> {
    List<ProjectInstallCategory> findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long projectId);
}
