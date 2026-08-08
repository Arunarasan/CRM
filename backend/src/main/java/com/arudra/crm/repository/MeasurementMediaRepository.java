package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementMediaRepository extends JpaRepository<MeasurementMedia, Long> {
    List<MeasurementMedia> findByMeasurementId(Long measurementId);
    List<MeasurementMedia> findByMeasurementRoomId(Long roomId);
}
