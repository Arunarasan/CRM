package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteMeasurement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiteMeasurementRepository extends JpaRepository<SiteMeasurement, Long> {
    List<SiteMeasurement> findBySiteRoomId(Long siteRoomId);
}
