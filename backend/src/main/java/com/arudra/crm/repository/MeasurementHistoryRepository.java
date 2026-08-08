package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementHistoryRepository extends JpaRepository<MeasurementHistory, Long> {
    List<MeasurementHistory> findByMeasurementIdOrderByVersionNumberDesc(Long measurementId);
}
