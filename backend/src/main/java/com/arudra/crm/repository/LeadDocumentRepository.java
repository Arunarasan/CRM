package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadDocumentRepository extends JpaRepository<LeadDocument, Long> {
    List<LeadDocument> findByLeadId(Long leadId);
}
