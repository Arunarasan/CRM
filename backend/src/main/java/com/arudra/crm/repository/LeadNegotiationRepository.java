package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadNegotiation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadNegotiationRepository extends JpaRepository<LeadNegotiation, Long> {
    List<LeadNegotiation> findByLeadIdOrderByNegotiationDateDesc(Long leadId);
}
