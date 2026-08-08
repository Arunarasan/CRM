package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementChecklistRepository extends JpaRepository<MeasurementChecklist, Long> {
    List<MeasurementChecklist> findByMeasurementId(Long measurementId);
    List<MeasurementChecklist> findByMeasurementIdOrderBySortOrderAsc(Long measurementId);
}
