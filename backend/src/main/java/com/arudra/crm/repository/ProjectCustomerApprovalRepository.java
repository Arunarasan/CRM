package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectCustomerApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectCustomerApprovalRepository extends JpaRepository<ProjectCustomerApproval, Long> {
    List<ProjectCustomerApproval> findByProjectId(Long projectId);
}
