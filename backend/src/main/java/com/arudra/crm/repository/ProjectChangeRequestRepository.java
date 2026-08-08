package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectChangeRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectChangeRequestRepository extends JpaRepository<ProjectChangeRequest, Long> {
    List<ProjectChangeRequest> findByProjectIdOrderByIdDesc(Long projectId);
    Page<ProjectChangeRequest> findByStatusOrderByIdDesc(String status, Pageable pageable);

    /** Latest CR-xxxxxx numbers for sequential number generation. */
    @Query("SELECT c.requestNumber FROM ProjectChangeRequest c WHERE c.requestNumber LIKE 'CR-%' ORDER BY c.requestNumber DESC")
    List<String> findLatestRequestNumbers(Pageable pageable);
}
