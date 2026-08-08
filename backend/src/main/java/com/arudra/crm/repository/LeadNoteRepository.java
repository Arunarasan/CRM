package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadNoteRepository extends JpaRepository<LeadNote, Long> {
    List<LeadNote> findByLeadIdOrderByCreatedAtDesc(Long leadId);
}
