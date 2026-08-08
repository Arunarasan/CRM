package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadStatusHistoryRepository extends JpaRepository<LeadStatusHistory, Long> {
    List<LeadStatusHistory> findByLeadIdOrderByChangedAtDesc(Long leadId);
}
