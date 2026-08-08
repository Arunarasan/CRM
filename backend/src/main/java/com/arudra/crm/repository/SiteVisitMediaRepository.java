package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteVisitMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteVisitMediaRepository extends JpaRepository<SiteVisitMedia, Long> {
    List<SiteVisitMedia> findBySiteVisitId(Long siteVisitId);
}
