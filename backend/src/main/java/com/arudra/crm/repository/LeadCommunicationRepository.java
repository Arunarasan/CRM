package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadCommunication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadCommunicationRepository extends JpaRepository<LeadCommunication, Long> {
    List<LeadCommunication> findByLeadIdOrderByCommunicationDateDescCommunicationTimeDesc(Long leadId);
}
