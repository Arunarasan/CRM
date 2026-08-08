package com.arudra.crm.repository;

import com.arudra.crm.entity.LeadLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeadLabelRepository extends JpaRepository<LeadLabel, Long> {
    List<LeadLabel> findByLeadId(Long leadId);
}
