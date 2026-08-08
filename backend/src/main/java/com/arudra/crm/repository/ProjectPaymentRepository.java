package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectPaymentRepository extends JpaRepository<ProjectPayment, Long> {
    List<ProjectPayment> findByProjectId(Long projectId);
}
