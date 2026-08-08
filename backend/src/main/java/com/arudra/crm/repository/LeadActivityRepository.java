package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadActivityRepository extends JpaRepository<LeadActivity, Long> {
    List<LeadActivity> findByLeadIdOrderByCreatedAtDesc(Long leadId);
}
