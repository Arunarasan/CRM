package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementDoor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementDoorRepository extends JpaRepository<MeasurementDoor, Long> {
    List<MeasurementDoor> findByMeasurementRoomId(Long roomId);
}
