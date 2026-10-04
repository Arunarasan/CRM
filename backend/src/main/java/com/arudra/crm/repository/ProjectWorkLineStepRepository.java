package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectWorkLineStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectWorkLineStepRepository extends JpaRepository<ProjectWorkLineStep, Long> {
    List<ProjectWorkLineStep> findByWorkLineIdInAndIsDeletedFalseOrderBySortOrderAscIdAsc(List<Long> workLineIds);

    List<ProjectWorkLineStep> findByWorkLineIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long workLineId);
}
