package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementActivityLogRepository extends JpaRepository<MeasurementActivityLog, Long> {
    List<MeasurementActivityLog> findByMeasurementIdOrderByActionTimeDesc(Long measurementId);
    List<MeasurementActivityLog> findByMeasurementIdOrderByActionTimeAsc(Long measurementId);
}
