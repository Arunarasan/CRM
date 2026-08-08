package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadReminderRepository extends JpaRepository<LeadReminder, Long> {
    List<LeadReminder> findByLeadIdOrderByReminderTimeAsc(Long leadId);

    List<LeadReminder> findByIsCompletedFalseAndReminderTimeBetween(java.time.LocalDateTime start,
            java.time.LocalDateTime end);
}
