package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementCeiling;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementCeilingRepository extends JpaRepository<MeasurementCeiling, Long> {
    List<MeasurementCeiling> findByMeasurementRoomId(Long roomId);
}
