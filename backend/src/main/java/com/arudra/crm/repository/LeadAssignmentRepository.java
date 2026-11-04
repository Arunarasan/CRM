package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadAssignmentRepository extends JpaRepository<LeadAssignment, Long> {
    List<LeadAssignment> findByLeadIdOrderByAssignedDateDesc(Long leadId);

    @org.springframework.data.jpa.repository.Query(
            "SELECT a FROM LeadAssignment a JOIN FETCH a.assignedTo WHERE a.lead.id IN :ids ORDER BY a.assignedDate DESC")
    List<LeadAssignment> findWithUserByLeadIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
}
