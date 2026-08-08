package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadFollowup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadFollowupRepository extends JpaRepository<LeadFollowup, Long> {
    List<LeadFollowup> findByLeadIdOrderByFollowupDateDesc(Long leadId);
}
