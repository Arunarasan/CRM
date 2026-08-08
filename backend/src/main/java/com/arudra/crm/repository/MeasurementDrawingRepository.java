package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementDrawing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementDrawingRepository extends JpaRepository<MeasurementDrawing, Long> {
    List<MeasurementDrawing> findByMeasurementId(Long measurementId);
}
