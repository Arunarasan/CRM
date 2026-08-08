package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadAssignmentRepository extends JpaRepository<LeadAssignment, Long> {
    List<LeadAssignment> findByLeadIdOrderByAssignedDateDesc(Long leadId);
}
