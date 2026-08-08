package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementRoomRepository extends JpaRepository<MeasurementRoom, Long> {
    List<MeasurementRoom> findByMeasurementId(Long measurementId);

    List<MeasurementRoom> findByMeasurementIdAndRoomType(Long measurementId, String roomType);
}
