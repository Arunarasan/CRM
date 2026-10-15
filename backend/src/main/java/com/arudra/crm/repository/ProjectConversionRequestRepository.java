package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectConversionRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectConversionRequestRepository extends JpaRepository<ProjectConversionRequest, Long> {
    Optional<ProjectConversionRequest> findFirstByLeadIdAndIsDeletedFalseOrderByIdDesc(Long leadId);

    boolean existsByLeadIdAndStatusAndIsDeletedFalse(Long leadId, String status);

    List<ProjectConversionRequest> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);
}
