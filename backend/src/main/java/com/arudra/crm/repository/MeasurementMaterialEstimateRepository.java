package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementMaterialEstimate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeasurementMaterialEstimateRepository extends JpaRepository<MeasurementMaterialEstimate, Long> {
    MeasurementMaterialEstimate findByMeasurementId(Long measurementId);
}
