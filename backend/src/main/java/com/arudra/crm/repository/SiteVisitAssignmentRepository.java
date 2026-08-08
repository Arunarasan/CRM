package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteVisitAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteVisitAssignmentRepository extends JpaRepository<SiteVisitAssignment, Long> {
    List<SiteVisitAssignment> findBySiteVisitId(Long siteVisitId);
    List<SiteVisitAssignment> findByAssignedUserId(Long userId);
}
