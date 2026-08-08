package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteVisitHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteVisitHistoryRepository extends JpaRepository<SiteVisitHistory, Long> {
    List<SiteVisitHistory> findBySiteVisitIdOrderByActionTimestampDesc(Long siteVisitId);
}
