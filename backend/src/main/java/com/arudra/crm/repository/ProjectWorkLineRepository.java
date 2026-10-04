package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectWorkLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectWorkLineRepository extends JpaRepository<ProjectWorkLine, Long> {
    List<ProjectWorkLine> findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long projectId);

    boolean existsByProjectIdAndIsDeletedFalse(Long projectId);
}
