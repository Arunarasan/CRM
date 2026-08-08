package com.arudra.crm.repository;

import com.arudra.crm.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    long countByStatus(String status);
    
    @Query("SELECT p FROM Project p WHERE " +
           "LOWER(p.projectName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Project> searchProjects(@Param("search") String search, Pageable pageable);

    java.util.List<Project> findByStatus(String status);
    java.util.List<Project> findByCustomerId(Long customerId);
    Page<Project> findByCustomerId(Long customerId, Pageable pageable);
    java.util.List<Project> findByLeadIdOrderByIdDesc(Long leadId);
    boolean existsByBoqId(Long boqId);
}
