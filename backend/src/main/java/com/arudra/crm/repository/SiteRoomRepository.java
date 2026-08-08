package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteRoomRepository extends JpaRepository<SiteRoom, Long> {
    List<SiteRoom> findBySiteVisitId(Long siteVisitId);
}
