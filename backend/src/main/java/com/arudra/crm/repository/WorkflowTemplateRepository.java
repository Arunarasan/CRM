package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkflowTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, Long> {
    Optional<WorkflowTemplate> findByCode(String code);
    List<WorkflowTemplate> findByScopeAndActiveTrue(String scope);
    List<WorkflowTemplate> findByScope(String scope);
}
