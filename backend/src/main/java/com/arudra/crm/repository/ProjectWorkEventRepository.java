package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectWorkEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectWorkEventRepository extends JpaRepository<ProjectWorkEvent, Long> {
    List<ProjectWorkEvent> findByProjectIdAndIsDeletedFalseOrderByCreatedAtDesc(Long projectId);
}
